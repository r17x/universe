{
  perSystem =
    { pkgs, ... }:
    let
      # ============================================================
      # Service Commands (Platform-specific)
      # ============================================================
      serviceCommands =
        if pkgs.stdenv.isDarwin then
          import ./universe/service-darwin.nix
        else
          import ./universe/service-linux.nix;

      # ============================================================
      # Identity Commands (GPG/Git identity management)
      # ============================================================
      identityCommands = ''
        identity_usage() {
          echo "Usage: universe identity <command> [options]"
          echo ""
          echo "Commands:"
          echo "  add <name> <real_name> <email> [gitdirs...] [--ssh-key <path>]    Add new identity (generate GPG key)"
          echo "  regen <name> [name2...]                                            Regenerate GPG key(s) for existing identity"
          echo "  import <name> <real_name> <email> [gitdirs...] [--ssh-key <path>]  Import existing GPG key as identity"
          echo "  set <name> [--ssh-key <path>]                                      Update an existing identity"
          echo "  remove <name> [name2...]                                           Remove identity from sops"
          echo "  sync                                                               Sync GPG and SSH keys from sops to local"
          echo "  list                                                               List identities from sops"
          echo "  export <email>                                                     Export secret GPG key for email"
          echo "  export-all <dir>                                                   Export all identities and GPG keys to directory"
          echo "  import-all <dir>                                                   Import all identities and GPG keys from directory"
          echo "  pubkey <name|email>                                                Export public GPG key by identity or email"
          echo ""
          echo "Examples:"
          echo "  universe identity add myid 'My Name' 'me@example.com'"
          echo "  universe identity add myid 'My Name' 'me@example.com' ~/projects/ ~/work/"
          echo "  universe identity regen myid"
          echo "  universe identity remove myid"
          echo "  universe identity import myid 'My Name' 'me@example.com' ~/code/"
          echo "  universe identity add work 'My Name' 'me@work.com' ~/work/ --ssh-key ~/.ssh/id_work"
          echo "  universe identity set rocks --ssh-key ~/.ssh/id_rocks"
          echo "  universe identity pubkey myid"
          echo "  universe identity pubkey me@example.com"
          echo "  universe identity export-all ./backup"
          echo "  universe identity import-all ./backup"
        }

        normalize_gitdirs() {
          sed "s|$HOME/|~/|g" | sed 's|/*$|/|'
        }

        get_identities() {
          ${pkgs.sops}/bin/sops -d --extract '["git_identities"]' "$SECRETS_FILE" 2>/dev/null || echo '{}'
        }

        set_identities() {
          local json="$1"
          local json_string
          json_string=$(echo "$json" | ${pkgs.jq}/bin/jq -Rs .)
          ${pkgs.sops}/bin/sops set "$SECRETS_FILE" '["git_identities"]' "$json_string"
        }

        upsert_identity() {
          local name="$1"
          local real_name="$2"
          local email="$3"
          local signingKey="$4"
          local gitdirs_json="''${5:-}"
          local sshKey="''${6:-}"

          local current
          current=$(get_identities)

          local base_obj
          base_obj=$(${pkgs.jq}/bin/jq -n \
            --arg real_name "$real_name" \
            --arg email "$email" \
            --arg signingKey "$signingKey" \
            '{name: $real_name, email: $email, signingKey: $signingKey}')

          if [ -n "$gitdirs_json" ]; then
            base_obj=$(echo "$base_obj" | ${pkgs.jq}/bin/jq --argjson gitdirs "$gitdirs_json" '. + {gitdirs: $gitdirs}')
          fi

          if [ -n "$sshKey" ]; then
            base_obj=$(echo "$base_obj" | ${pkgs.jq}/bin/jq --arg sshKey "$sshKey" '. + {sshKey: $sshKey}')
          fi

          local updated
          updated=$(echo "$current" | ${pkgs.jq}/bin/jq --arg name "$name" --argjson obj "$base_obj" '.[$name] = $obj')

          set_identities "$updated"
        }

        parse_identity_args() {
          local ssh_key=""
          local gitdirs=()
          while [ $# -gt 0 ]; do
            case "$1" in
              --ssh-key)
                shift
                ssh_key=$(echo "$1" | sed "s|$HOME/|~/|g")
                ;;
              *)
                gitdirs+=("$1")
                ;;
            esac
            shift
          done
          PARSED_SSH_KEY="$ssh_key"
          PARSED_GITDIRS=("''${gitdirs[@]}")
        }

        identity_add() {
          local name="$1"
          local real_name="$2"
          local email="$3"
          shift 3
          parse_identity_args "$@"
          local gitdirs=("''${PARSED_GITDIRS[@]}")
          local ssh_key="$PARSED_SSH_KEY"

          if ${pkgs.gnupg}/bin/gpg --list-secret-keys "$email" &>/dev/null; then
            echo "GPG key for $email already exists. Use 'import' to add it."
            exit 1
          fi

          echo "==> Generating GPG key for $name ($email)..."

          ${pkgs.gnupg}/bin/gpg --batch --gen-key <<EOF
        Key-Type: RSA
        Key-Length: 4096
        Name-Real: $real_name
        Name-Email: $email
        Expire-Date: 0
        %no-protection
        EOF

          KEY_ID=$(${pkgs.gnupg}/bin/gpg --list-keys --keyid-format long "$email" | grep "^pub" | tail -1 | sed 's|.*/||' | ${pkgs.gawk}/bin/awk '{print $1}')
          echo "    Key ID: $KEY_ID"

          echo ""
          echo "==> Adding identity to git_identities..."
          local gitdirs_json=""
          if [ ''${#gitdirs[@]} -gt 0 ]; then
            gitdirs_json=$(printf '%s\n' "''${gitdirs[@]}" | normalize_gitdirs | ${pkgs.jq}/bin/jq -R . | ${pkgs.jq}/bin/jq -s .)
            echo "    Gitdirs: ''${gitdirs[*]}"
          fi
          if [ -n "$ssh_key" ]; then
            echo "    SSH Key: $ssh_key"
          fi
          upsert_identity "$name" "$real_name" "$email" "$KEY_ID" "$gitdirs_json" "$ssh_key"
          echo "    Updated git_identities"

          echo ""
          echo "==> Adding GPG key to sops..."
          EXPORTED_KEY=$(${pkgs.gnupg}/bin/gpg --export-secret-keys --armor "$email")
          JSON_KEY=$(echo "$EXPORTED_KEY" | ${pkgs.jq}/bin/jq -Rs .)
          ${pkgs.sops}/bin/sops set "$SECRETS_FILE" "[\"''${name}_gpg_key\"]" "$JSON_KEY"
          echo "    Updated $SECRETS_FILE"

          if [ -n "$ssh_key" ]; then
            store_ssh_key "$name" "$ssh_key"
          fi

          echo ""
          echo "==> Running darwin-rebuild switch..."
          sudo darwin-rebuild switch --flake "$FLAKE_ROOT"

          echo ""
          echo "Done! Identity '$name' has been added."
        }

        identity_regen_one() {
          local name="$1"
          local identities
          identities=$(get_identities)

          local identity
          identity=$(echo "$identities" | ${pkgs.jq}/bin/jq -r --arg name "$name" '.[$name] // empty')

          if [ -z "$identity" ]; then
            echo "Error: Identity '$name' not found in git_identities."
            return 1
          fi

          local real_name email
          real_name=$(echo "$identity" | ${pkgs.jq}/bin/jq -r '.name')
          email=$(echo "$identity" | ${pkgs.jq}/bin/jq -r '.email')

          echo "==> Regenerating GPG key for $name ($real_name <$email>)..."

          if ${pkgs.gnupg}/bin/gpg --list-secret-keys "$email" &>/dev/null; then
            OLD_FP=$(${pkgs.gnupg}/bin/gpg --list-secret-keys --with-colons "$email" 2>/dev/null | grep fpr | head -1 | cut -d: -f10)
            echo "    Old fingerprint: $OLD_FP"
            echo "    Deleting old key..."
            ${pkgs.gnupg}/bin/gpg --batch --yes --delete-secret-keys "$OLD_FP" 2>/dev/null || true
            ${pkgs.gnupg}/bin/gpg --batch --yes --delete-keys "$OLD_FP" 2>/dev/null || true
          else
            echo "    No existing GPG key found, creating new one"
          fi

          echo "    Generating new GPG key..."
          ${pkgs.gnupg}/bin/gpg --batch --gen-key <<EOF
        Key-Type: RSA
        Key-Length: 4096
        Name-Real: $real_name
        Name-Email: $email
        Expire-Date: 0
        %no-protection
        EOF

          NEW_KEY_ID=$(${pkgs.gnupg}/bin/gpg --list-keys --keyid-format long "$email" | grep "^pub" | tail -1 | sed 's|.*/||' | ${pkgs.gawk}/bin/awk '{print $1}')
          echo "    New Key ID: $NEW_KEY_ID"

          upsert_identity "$name" "$real_name" "$email" "$NEW_KEY_ID"
          echo "    Updated git_identities"

          EXPORTED_KEY=$(${pkgs.gnupg}/bin/gpg --export-secret-keys --armor "$email")
          JSON_KEY=$(echo "$EXPORTED_KEY" | ${pkgs.jq}/bin/jq -Rs .)
          ${pkgs.sops}/bin/sops set "$SECRETS_FILE" "[\"''${name}_gpg_key\"]" "$JSON_KEY"
          echo "    Updated sops secret"
          echo ""
        }

        identity_regen() {
          if [ $# -eq 0 ]; then
            echo "Error: regen requires at least one identity name"
            exit 1
          fi

          local failed=0
          for name in "$@"; do
            identity_regen_one "$name" || failed=1
          done

          if [ $failed -eq 1 ]; then
            echo "Some identities failed to regenerate."
            exit 1
          fi

          echo "==> Running darwin-rebuild switch..."
          sudo darwin-rebuild switch --flake "$FLAKE_ROOT"

          echo ""
          echo "Done! Regenerated: $*"
        }

        identity_import() {
          local name="$1"
          local real_name="$2"
          local email="$3"
          shift 3
          parse_identity_args "$@"
          local gitdirs=("''${PARSED_GITDIRS[@]}")
          local ssh_key="$PARSED_SSH_KEY"

          echo "==> Importing existing GPG key for $name ($email)..."

          if ! ${pkgs.gnupg}/bin/gpg --list-secret-keys "$email" &>/dev/null; then
            echo "Error: No secret key found for $email"
            exit 1
          fi

          KEY_ID=$(${pkgs.gnupg}/bin/gpg --list-keys --keyid-format long "$email" | grep "^pub" | tail -1 | sed 's|.*/||' | ${pkgs.gawk}/bin/awk '{print $1}')
          echo "    Key ID: $KEY_ID"

          echo ""
          echo "==> Adding identity to git_identities..."
          local gitdirs_json=""
          if [ ''${#gitdirs[@]} -gt 0 ]; then
            gitdirs_json=$(printf '%s\n' "''${gitdirs[@]}" | normalize_gitdirs | ${pkgs.jq}/bin/jq -R . | ${pkgs.jq}/bin/jq -s .)
            echo "    Gitdirs: ''${gitdirs[*]}"
          fi
          if [ -n "$ssh_key" ]; then
            echo "    SSH Key: $ssh_key"
          fi
          upsert_identity "$name" "$real_name" "$email" "$KEY_ID" "$gitdirs_json" "$ssh_key"
          echo "    Updated git_identities"

          echo ""
          echo "==> Adding GPG key to sops..."
          EXPORTED_KEY=$(${pkgs.gnupg}/bin/gpg --export-secret-keys --armor "$email")
          JSON_KEY=$(echo "$EXPORTED_KEY" | ${pkgs.jq}/bin/jq -Rs .)
          ${pkgs.sops}/bin/sops set "$SECRETS_FILE" "[\"''${name}_gpg_key\"]" "$JSON_KEY"
          echo "    Updated $SECRETS_FILE"

          if [ -n "$ssh_key" ]; then
            store_ssh_key "$name" "$ssh_key"
          fi

          echo ""
          echo "==> Running darwin-rebuild switch..."
          sudo darwin-rebuild switch --flake "$FLAKE_ROOT"

          echo ""
          echo "Done! Identity '$name' has been imported."
        }

        identity_remove_one() {
          local name="$1"
          local identities
          identities=$(get_identities)

          local identity
          identity=$(echo "$identities" | ${pkgs.jq}/bin/jq -r --arg name "$name" '.[$name] // empty')

          if [ -z "$identity" ]; then
            echo "Error: Identity '$name' not found in git_identities."
            return 1
          fi

          local email
          email=$(echo "$identity" | ${pkgs.jq}/bin/jq -r '.email')

          echo "==> Removing identity '$name' ($email)..."

          local updated
          updated=$(echo "$identities" | ${pkgs.jq}/bin/jq --arg name "$name" 'del(.[$name])')
          set_identities "$updated"
          echo "    Removed from git_identities"

          if ${pkgs.sops}/bin/sops -d --extract "[\"''${name}_gpg_key\"]" "$SECRETS_FILE" &>/dev/null; then
            ${pkgs.sops}/bin/sops --set "[\"''${name}_gpg_key\"]" "null" "$SECRETS_FILE" 2>/dev/null || true
            echo "    Removed GPG key from sops"
          fi

          echo ""
        }

        identity_remove() {
          if [ $# -eq 0 ]; then
            echo "Error: remove requires at least one identity name"
            exit 1
          fi

          local failed=0
          for name in "$@"; do
            identity_remove_one "$name" || failed=1
          done

          if [ $failed -eq 1 ]; then
            echo "Some identities failed to remove."
            exit 1
          fi

          echo "==> Running darwin-rebuild switch..."
          sudo darwin-rebuild switch --flake "$FLAKE_ROOT"

          echo ""
          echo "Done! Removed: $*"
        }

        identity_list() {
          echo "Git identities (from sops):"
          echo ""
          local identities
          identities=$(get_identities)

          echo "$identities" | ${pkgs.jq}/bin/jq -r '
            to_entries[] |
            "  \(.key):\n    name: \(.value.name)\n    email: \(.value.email)\n    signingKey: \(.value.signingKey)" +
            (if .value.sshKey then "\n    sshKey: \(.value.sshKey)" else "" end) +
            (if .value.gitdirs then "\n    gitdirs: \(.value.gitdirs | join(", "))" else "" end) +
            "\n"
          '
        }

        identity_export() {
          local email="$1"
          ${pkgs.gnupg}/bin/gpg --export-secret-keys --armor "$email"
        }

        identity_export_all() {
          local outdir="$1"
          mkdir -p "$outdir"

          local identities
          identities=$(get_identities)

          echo "$identities" | ${pkgs.jq}/bin/jq --arg home "$HOME" '
            map_values(
              if .gitdirs then .gitdirs |= [.[] | gsub($home + "/"; "~/")] else . end
            )
          ' > "$outdir/identities.json"
          echo "==> Exported identities.json"

          local names
          names=$(echo "$identities" | ${pkgs.jq}/bin/jq -r 'keys[]')

          for name in $names; do
            local gpg_key
            gpg_key=$(${pkgs.sops}/bin/sops -d --extract "[\"''${name}_gpg_key\"]" "$SECRETS_FILE" 2>/dev/null || true)
            if [ -n "$gpg_key" ]; then
              echo "$gpg_key" > "$outdir/$name.gpg"
              echo "    Exported $name.gpg"
            else
              echo "    Warning: No GPG key found in sops for '$name', skipping"
            fi

            local ssh_key
            ssh_key=$(${pkgs.sops}/bin/sops -d --extract "[\"''${name}_ssh_key\"]" "$SECRETS_FILE" 2>/dev/null || true)
            if [ -n "$ssh_key" ]; then
              echo "$ssh_key" > "$outdir/$name.ssh"
              echo "    Exported $name.ssh"
            fi
          done

          echo ""
          echo "Done! Exported all identities to $outdir"
        }

        identity_import_all() {
          local indir="$1"

          if [ ! -f "$indir/identities.json" ]; then
            echo "Error: $indir/identities.json not found"
            exit 1
          fi

          local identities
          identities=$(cat "$indir/identities.json")

          local names
          names=$(echo "$identities" | ${pkgs.jq}/bin/jq -r 'keys[]')

          echo "==> Importing all GPG keys into keyring..."
          for name in $names; do
            local gpg_file="$indir/$name.gpg"
            if [ -f "$gpg_file" ]; then
              local email
              email=$(echo "$identities" | ${pkgs.jq}/bin/jq -r --arg n "$name" '.[$n].email')
              echo "    Importing $name.gpg..."
              ${pkgs.gnupg}/bin/gpg --batch --import "$gpg_file" 2>/dev/null || true
              KEY_FP=$(${pkgs.gnupg}/bin/gpg --list-keys --with-colons "$email" 2>/dev/null | grep fpr | head -1 | cut -d: -f10)
              if [ -n "$KEY_FP" ]; then
                echo "$KEY_FP:6:" | ${pkgs.gnupg}/bin/gpg --import-ownertrust 2>/dev/null || true
              fi
              echo "    Trusted $name ($email)"
            else
              echo "    Warning: No GPG key file for '$name', skipping"
            fi
          done

          echo ""
          echo "==> Storing identities and keys in sops..."
          for name in $names; do
            local identity
            identity=$(echo "$identities" | ${pkgs.jq}/bin/jq -r --arg n "$name" '.[$n]')
            local real_name email signingKey
            real_name=$(echo "$identity" | ${pkgs.jq}/bin/jq -r '.name')
            email=$(echo "$identity" | ${pkgs.jq}/bin/jq -r '.email')
            signingKey=$(echo "$identity" | ${pkgs.jq}/bin/jq -r '.signingKey' | tail -1)
            local ssh_key
            ssh_key=$(echo "$identity" | ${pkgs.jq}/bin/jq -r '.sshKey // empty')
            local gitdirs_json=""
            if echo "$identity" | ${pkgs.jq}/bin/jq -e '.gitdirs' &>/dev/null; then
              gitdirs_json=$(echo "$identity" | ${pkgs.jq}/bin/jq -c --arg home "$HOME" '[.gitdirs[] | gsub($home + "/"; "~/")]')
            fi

            local gpg_file="$indir/$name.gpg"
            if [ -f "$gpg_file" ]; then
              echo "    Storing GPG key in sops for $name..."
              local json_key
              json_key=$(cat "$gpg_file" | ${pkgs.jq}/bin/jq -Rs .)
              ${pkgs.sops}/bin/sops set "$SECRETS_FILE" "[\"''${name}_gpg_key\"]" "$json_key"
            fi

            local ssh_file="$indir/$name.ssh"
            if [ -f "$ssh_file" ]; then
              echo "    Storing SSH key in sops for $name..."
              local json_ssh
              json_ssh=$(cat "$ssh_file" | ${pkgs.jq}/bin/jq -Rs .)
              ${pkgs.sops}/bin/sops set "$SECRETS_FILE" "[\"''${name}_ssh_key\"]" "$json_ssh"
            fi

            echo "    Upserting identity $name..."
            upsert_identity "$name" "$real_name" "$email" "$signingKey" "$gitdirs_json" "$ssh_key"
          done

          echo ""
          echo "==> Running darwin-rebuild switch..."
          sudo darwin-rebuild switch --flake "$FLAKE_ROOT"

          echo ""
          echo "Done! Imported all identities from $indir"
        }

        identity_sync() {
          local identities
          identities=$(get_identities)

          local names
          names=$(echo "$identities" | ${pkgs.jq}/bin/jq -r 'keys[]')

          echo "==> Syncing GPG and SSH keys from sops to local..."
          for name in $names; do
            local identity
            identity=$(echo "$identities" | ${pkgs.jq}/bin/jq -r --arg n "$name" '.[$n]')
            local email
            email=$(echo "$identity" | ${pkgs.jq}/bin/jq -r '.email')

            # Sync GPG key
            local gpg_key
            gpg_key=$(${pkgs.sops}/bin/sops -d --extract "[\"''${name}_gpg_key\"]" "$SECRETS_FILE" 2>/dev/null || true)
            if [ -n "$gpg_key" ]; then
              echo "$gpg_key" | ${pkgs.gnupg}/bin/gpg --batch --import 2>/dev/null || true
              KEY_FP=$(${pkgs.gnupg}/bin/gpg --list-keys --with-colons "$email" 2>/dev/null | grep fpr | head -1 | cut -d: -f10)
              if [ -n "$KEY_FP" ]; then
                echo "$KEY_FP:6:" | ${pkgs.gnupg}/bin/gpg --import-ownertrust 2>/dev/null || true
              fi
              echo "    Synced GPG key for $name ($email)"
            fi

            # Sync SSH key
            local ssh_key_path
            ssh_key_path=$(echo "$identity" | ${pkgs.jq}/bin/jq -r '.sshKey // empty')
            if [ -n "$ssh_key_path" ]; then
              local expanded_path
              expanded_path=$(echo "$ssh_key_path" | sed "s|^~|$HOME|")
              local ssh_key_content
              ssh_key_content=$(${pkgs.sops}/bin/sops -d --extract "[\"''${name}_ssh_key\"]" "$SECRETS_FILE" 2>/dev/null || true)
              if [ -n "$ssh_key_content" ]; then
                mkdir -p "$(dirname "$expanded_path")"
                echo "$ssh_key_content" > "$expanded_path"
                chmod 600 "$expanded_path"
                echo "    Synced SSH key for $name -> $ssh_key_path"
              fi
            fi
          done

          echo ""
          echo "Done!"
        }

        store_ssh_key() {
          local name="$1"
          local ssh_key_path="$2"
          local expanded_path
          expanded_path=$(echo "$ssh_key_path" | sed "s|^~|$HOME|")

          if [ ! -f "$expanded_path" ]; then
            echo "Error: SSH key file not found: $expanded_path"
            exit 1
          fi

          echo "    Storing SSH key in sops for $name..."
          local json_key
          json_key=$(cat "$expanded_path" | ${pkgs.jq}/bin/jq -Rs .)
          ${pkgs.sops}/bin/sops set "$SECRETS_FILE" "[\"''${name}_ssh_key\"]" "$json_key"
        }

        identity_set() {
          local name="$1"
          shift

          local identities
          identities=$(get_identities)

          local identity
          identity=$(echo "$identities" | ${pkgs.jq}/bin/jq -r --arg name "$name" '.[$name] // empty')

          if [ -z "$identity" ]; then
            echo "Error: Identity '$name' not found."
            exit 1
          fi

          local updated="$identities"
          while [ $# -gt 0 ]; do
            case "$1" in
              --ssh-key)
                shift
                local ssh_key
                ssh_key=$(echo "$1" | sed "s|$HOME/|~/|g")
                updated=$(echo "$updated" | ${pkgs.jq}/bin/jq --arg name "$name" --arg sshKey "$ssh_key" '.[$name].sshKey = $sshKey')
                store_ssh_key "$name" "$1"
                echo "    Set sshKey=$ssh_key for $name"
                ;;
              *)
                echo "Error: Unknown option '$1' for set"
                exit 1
                ;;
            esac
            shift
          done

          set_identities "$updated"

          echo ""
          echo "==> Running darwin-rebuild switch..."
          sudo darwin-rebuild switch --flake "$FLAKE_ROOT"

          echo ""
          echo "Done! Updated identity '$name'."
        }

        identity_pubkey() {
          local query="$1"
          local email=""
          local identities
          identities=$(get_identities)

          email=$(echo "$identities" | ${pkgs.jq}/bin/jq -r --arg q "$query" '
            if .[$q] then .[$q].email
            else to_entries[] | select(.value.email == $q) | .value.email // empty
            end
          ' | head -1)

          if [ -z "$email" ]; then
            if ${pkgs.gnupg}/bin/gpg --list-keys "$query" &>/dev/null; then
              email="$query"
            else
              echo "Error: No identity or GPG key found for '$query'" >&2
              exit 1
            fi
          fi

          ${pkgs.gnupg}/bin/gpg --export --armor "$email"
        }

        cmd_identity() {
          case "''${1:-}" in
            add)
              shift
              if [ $# -lt 3 ]; then
                echo "Error: add requires <name> <real_name> <email> [gitdirs...]"
                exit 1
              fi
              identity_add "$@"
              ;;
            regen)
              shift
              identity_regen "$@"
              ;;
            import)
              shift
              if [ $# -lt 3 ]; then
                echo "Error: import requires <name> <real_name> <email> [gitdirs...]"
                exit 1
              fi
              identity_import "$@"
              ;;
            set)
              shift
              if [ $# -lt 2 ]; then
                echo "Error: set requires <name> and at least one option (e.g. --ssh-key <path>)"
                exit 1
              fi
              identity_set "$@"
              ;;
            remove)
              shift
              identity_remove "$@"
              ;;
            sync)
              identity_sync
              ;;
            list)
              identity_list
              ;;
            export)
              shift
              if [ $# -lt 1 ]; then
                echo "Error: export requires <email>"
                exit 1
              fi
              identity_export "$1"
              ;;
            export-all)
              shift
              if [ $# -lt 1 ]; then
                echo "Error: export-all requires <dir>"
                exit 1
              fi
              identity_export_all "$1"
              ;;
            import-all)
              shift
              if [ $# -lt 1 ]; then
                echo "Error: import-all requires <dir>"
                exit 1
              fi
              identity_import_all "$1"
              ;;
            pubkey)
              shift
              if [ $# -lt 1 ]; then
                echo "Error: pubkey requires <name|email>"
                exit 1
              fi
              identity_pubkey "$1"
              ;;
            help|-h|"")
              identity_usage
              ;;
            *)
              echo "Unknown command: $1"
              identity_usage
              exit 1
              ;;
          esac
        }
      '';

      # ============================================================
      # Main Script (Usage, rebuild, dispatch)
      # ============================================================
      mainScript = ''
        set -euo pipefail

        FLAKE_ROOT="''${FLAKE_ROOT:-$(pwd)}"
        SECRETS_FILE="$FLAKE_ROOT/secrets/secret.yaml"

        usage() {
          echo "Usage: universe <command> [options]"
          echo ""
          echo "Commands:"
          echo "  identity    Manage GPG identities for git"
          echo "  rebuild     Run darwin-rebuild switch"
          echo "  service     Manage system services"
          echo ""
          echo "Run 'universe <command> --help' for more information."
        }

        cmd_rebuild() {
          echo "==> Running darwin-rebuild switch..."
          sudo darwin-rebuild switch --flake "$FLAKE_ROOT" "$@"
        }

        case "''${1:-}" in
          identity)
            shift
            cmd_identity "$@"
            ;;
          rebuild)
            shift
            cmd_rebuild "$@"
            ;;
          service)
            shift
            cmd_service "$@"
            ;;
          --help|-h|"")
            usage
            ;;
          *)
            echo "Unknown command: $1"
            usage
            exit 1
            ;;
        esac
      '';

      # ============================================================
      # Final Universe CLI
      # ============================================================
      universe = pkgs.writeShellScriptBin "universe" ''
        ${serviceCommands}
        ${identityCommands}
        ${mainScript}
      '';
    in
    {
      packages.universe = universe;
      packages.default = universe;
      apps.universe = {
        type = "app";
        program = "${universe}/bin/universe";
      };
    };
}
