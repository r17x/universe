{ den, inputs, ... }:
{
  den.aspects.secrets = {
    includes = with den.aspects.secrets.provides; [
      sops-keys
      pass
    ];

    provides.sops-keys =
      { user, ... }:
      {
        homeManager =
          {
            config,
            lib,
            pkgs,
            ...
          }:
          let
            allSecretNames = user.secrets ++ lib.attrNames user.gpgTrust;
            gpgTrustCommands = lib.concatStringsSep "\n" (
              lib.mapAttrsToList (
                secretName: email: ''import_and_trust "${config.sops.secrets.${secretName}.path}" "${email}"''
              ) user.gpgTrust
            );
          in
          {
            imports = [
              inputs.sops-nix.homeManagerModules.sops
            ];

            sops.gnupg.home = "~/.gnupg";
            sops.gnupg.sshKeyPaths = [ ];
            sops.defaultSopsFile = "${inputs.self}/secrets/secret.yaml";
            sops.secrets = lib.genAttrs allSecretNames (_: { });

            programs.git.extraConfig.diff.sopsdiffer.textconv = "sops -d --config /dev/null";

            home.activation.importGpgKeys = lib.mkIf (user.gpgTrust != { }) (
              lib.hm.dag.entryAfter [ "writeBoundary" "setupSecrets" ] ''
                export GPG_TTY=$(tty)

                import_and_trust() {
                  local secret_path="$1"
                  local email="$2"
                  if [ -f "$secret_path" ]; then
                    ${pkgs.gnupg}/bin/gpg --batch --import "$secret_path" 2>/dev/null || true
                    KEY_FP=$(${pkgs.gnupg}/bin/gpg --list-keys --with-colons "$email" 2>/dev/null | grep fpr | head -1 | cut -d: -f10)
                    if [ -n "$KEY_FP" ]; then
                      echo "$KEY_FP:6:" | ${pkgs.gnupg}/bin/gpg --import-ownertrust 2>/dev/null || true
                    fi
                  fi
                }

                ${gpgTrustCommands}
              ''
            );

            home.activation.generateGitIdentities =
              lib.hm.dag.entryAfter
                [
                  "writeBoundary"
                  "setupSecrets"
                ]
                ''
                      # Use sops-nix decrypted secret path
                      IDENTITIES_FILE="${config.sops.secrets.git_identities.path}"
                      GITCONFIG_D="$HOME/.config/git/config.d"
                      INCLUDES_FILE="$HOME/.config/git/identities.gitconfig"

                      if [ -f "$IDENTITIES_FILE" ]; then
                        mkdir -p "$GITCONFIG_D"

                        # Clear includes file and old config files
                        : > "$INCLUDES_FILE"
                        rm -f "$GITCONFIG_D"/*.conf

                        # Read already-decrypted identities
                        IDENTITIES=$(cat "$IDENTITIES_FILE")

                        if [ -n "$IDENTITIES" ]; then
                          # Generate config file for each identity
                          echo "$IDENTITIES" | ${pkgs.jq}/bin/jq -r 'to_entries[] | "\(.key)|\(.value.name)|\(.value.email)|\(.value.signingKey)|\(.value.sshKey // "")"' | \
                          while IFS='|' read -r id name email signingKey sshKey; do
                            cat > "$GITCONFIG_D/$id.conf" <<EOF
                  [user]
                    name = $name
                    email = $email
                    signingKey = $signingKey
                  EOF
                            if [ -n "$sshKey" ]; then
                              expanded_ssh_key=$(echo "$sshKey" | sed "s|^~|$HOME|")
                              cat >> "$GITCONFIG_D/$id.conf" <<EOF
                  [core]
                    sshCommand = ssh -i $expanded_ssh_key -o IdentitiesOnly=yes
                  EOF
                            fi
                          done

                          # Generate includeIf for each gitdir (always includes domain + custom gitdirs)
                          echo "$IDENTITIES" | ${pkgs.jq}/bin/jq -r '
                          to_entries[] |
                          .key as $id |
                          .value.email as $email |
                          (($email | split("@")[1] | split(".")[0]) | "~/\(.)/") as $domain_dir |
                          ((.value.gitdirs // []) + [$domain_dir]) | unique | .[] |
                          "\($id)|\(.)"
                          ' | while IFS='|' read -r id gitdir; do
                            # Expand ~ to $HOME
                            expanded_gitdir=$(echo "$gitdir" | sed "s|^~|$HOME|")

                            # Create gitdir if not exists
                            mkdir -p "$expanded_gitdir"

                            # Append includeIf to includes file
                            cat >> "$INCLUDES_FILE" <<EOF
                  [includeIf "gitdir:$expanded_gitdir"]
                    path = $GITCONFIG_D/$id.conf
                  EOF
                          done
                        fi
                      fi
                '';

            home.packages = [
              pkgs.gnupg
              pkgs.sops
            ];
          };
      };

    provides.pass =
      { user, ... }:
      {
        homeManager =
          { pkgs, lib, ... }:
          {
            programs.password-store = {
              enable = true;
              package = pkgs.pass.withExtensions (p: [
                p.pass-otp
                p.pass-checkup
                p.pass-audit
                p.pass-update
              ]);
            };

            programs.browserpass = {
              enable = true;
              browsers = lib.mkIf (user.browsers != [ ]) user.browsers;
            };
          };
      };
  };
}
