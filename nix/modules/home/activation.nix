{ config, lib, pkgs, ... }:
{
  home.activation.importGpgKeys = lib.hm.dag.entryAfter ["writeBoundary" "setupSecrets"] ''
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

    import_and_trust "${config.sops.secrets.berkarya_gpg_key.path}" "rin@berkarya.ai"
  '';

  home.activation.generateGitIdentities = lib.hm.dag.entryAfter ["writeBoundary" "setupSecrets"] ''
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
        echo "$IDENTITIES" | ${pkgs.jq}/bin/jq -r 'to_entries[] | "\(.key)|\(.value.name)|\(.value.email)|\(.value.signingKey)"' | \
        while IFS='|' read -r id name email signingKey; do
          cat > "$GITCONFIG_D/$id.conf" <<EOF
[user]
  name = $name
  email = $email
  signingKey = $signingKey
EOF
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
}
