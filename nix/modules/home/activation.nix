{
  config,
  lib,
  pkgs,
  ...
}:
{
  home.activation.importGpgKeys = lib.hm.dag.entryAfter [ "writeBoundary" "setupSecrets" ] ''
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

  home.activation.generateGitIdentities = lib.hm.dag.entryAfter [ "writeBoundary" "setupSecrets" ] ''
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
          cat > "$GITCONFIG_D/$id.conf" <<GITEOF
    [user]
      name = $name
      email = $email
      signingKey = $signingKey
    GITEOF
          if [ -n "$sshKey" ]; then
            expanded_ssh_key=$(echo "$sshKey" | sed 's|^/Users/[^/]*/|~/|; s|^/home/[^/]*/|~/|' | sed "s|^~|$HOME|")
            cat >> "$GITCONFIG_D/$id.conf" <<GITEOF
    [core]
      sshCommand = ssh -i $expanded_ssh_key -o IdentitiesOnly=yes
    [url "git@github.$id:"]
      insteadOf = git@github.com:
    GITEOF
          fi
        done

        # Generate SSH config per identity (for clone with host alias)
        SSH_CONFIG_D="$HOME/.ssh/config.d"
        mkdir -p "$SSH_CONFIG_D"
        rm -f "$SSH_CONFIG_D"/*.conf

        # Ensure ~/.ssh/config includes config.d
        SSH_CONFIG="$HOME/.ssh/config"
        touch "$SSH_CONFIG"
        chmod 600 "$SSH_CONFIG"
        if ! grep -q "Include.*config\.d/\*" "$SSH_CONFIG" 2>/dev/null; then
          printf '%s\n\n%s' "Include ~/.ssh/config.d/*" "$(cat "$SSH_CONFIG")" > "$SSH_CONFIG"
        fi

        echo "$IDENTITIES" | ${pkgs.jq}/bin/jq -r 'to_entries[] | select(.value.sshKey) | "\(.key)|\(.value.sshKey)"' | \
        while IFS='|' read -r id sshKey; do
          expanded_ssh_key=$(echo "$sshKey" | sed 's|^/Users/[^/]*/|~/|; s|^/home/[^/]*/|~/|' | sed "s|^~|$HOME|")
          cat > "$SSH_CONFIG_D/$id.conf" <<SSHEOF
    Host github.$id
      HostName github.com
      User git
      IdentityFile $expanded_ssh_key
      IdentitiesOnly yes
    SSHEOF
          echo "    Generated SSH config for github.$id"
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
          # Normalize any hardcoded home paths, then expand ~ to $HOME
          expanded_gitdir=$(echo "$gitdir" | sed 's|^/Users/[^/]*/|~/|; s|^/home/[^/]*/|~/|' | sed "s|^~|$HOME|")

          # Create gitdir if not exists
          mkdir -p "$expanded_gitdir"

          # Append includeIf to includes file
          cat >> "$INCLUDES_FILE" <<INCEOF
    [includeIf "gitdir:$expanded_gitdir"]
      path = $GITCONFIG_D/$id.conf
    INCEOF
        done
      fi
    fi
  '';
}
