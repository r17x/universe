{
  perSystem =
    { pkgs, ... }:
    let
      universe = pkgs.writeShellScriptBin "universe" ''
                  set -euo pipefail

                  # Use FLAKE_ROOT env var or current directory
                  FLAKE_ROOT="''${FLAKE_ROOT:-$(pwd)}"
                  SECRETS_FILE="$FLAKE_ROOT/secrets/secret.yaml"

                  usage() {
                    echo "Usage: universe <command> [options]"
                    echo ""
                    echo "Commands:"
                    echo "  identity    Manage GPG identities for git"
                    echo "  rebuild     Run darwin-rebuild switch"
                    echo ""
                    echo "Run 'universe <command> --help' for more information."
                  }

                  cmd_rebuild() {
                    echo "==> Running darwin-rebuild switch..."
                    sudo darwin-rebuild switch --flake "$FLAKE_ROOT" "$@"
                  }

                  identity_usage() {
                    echo "Usage: universe identity [options]"
                    echo ""
                    echo "Options:"
                    echo "  --add <name> <real_name> <email> [gitdirs...]    Add new identity (generate GPG key)"
                    echo "  --regen <name> [name2...]                        Regenerate GPG key(s) for existing identity"
                    echo "  --import <name> <real_name> <email> [gitdirs...] Import existing GPG key as identity"
                    echo "  --remove <name> [name2...]                       Remove identity from sops"
                    echo "  --list                                           List identities from sops"
                    echo "  --export <email>                                 Export secret GPG key for email"
                    echo "  --pubkey <name|email>                            Export public GPG key by identity or email"
                    echo ""
                    echo "Examples:"
                    echo "  universe identity --add myid 'My Name' 'me@example.com'"
                    echo "  universe identity --add myid 'My Name' 'me@example.com' ~/projects/ ~/work/"
                    echo "  universe identity --regen myid"
                    echo "  universe identity --remove myid"
                    echo "  universe identity --import myid 'My Name' 'me@example.com' ~/code/"
                    echo "  universe identity --pubkey myid"
                    echo "  universe identity --pubkey me@example.com"
                  }

                  # Helper: Get current git_identities JSON from sops
                  get_identities() {
                    ${pkgs.sops}/bin/sops -d --extract '["git_identities"]' "$SECRETS_FILE" 2>/dev/null || echo '{}'
                  }

                  # Helper: Set git_identities JSON in sops (as JSON string)
                  set_identities() {
                    local json="$1"
                    # Encode as JSON string for sops (sops-nix expects string values)
                    local json_string
                    json_string=$(echo "$json" | ${pkgs.jq}/bin/jq -Rs .)
                    ${pkgs.sops}/bin/sops set "$SECRETS_FILE" '["git_identities"]' "$json_string"
                  }

                  # Helper: Add/update identity in git_identities
                  # Usage: upsert_identity <name> <real_name> <email> <signingKey> [gitdirs_json]
                  upsert_identity() {
                    local name="$1"
                    local real_name="$2"
                    local email="$3"
                    local signingKey="$4"
                    local gitdirs_json="''${5:-}"

                    local current
                    current=$(get_identities)

                    local updated
                    if [ -n "$gitdirs_json" ]; then
                      updated=$(echo "$current" | ${pkgs.jq}/bin/jq --arg name "$name" \
                        --arg real_name "$real_name" \
                        --arg email "$email" \
                        --arg signingKey "$signingKey" \
                        --argjson gitdirs "$gitdirs_json" \
                        '.[$name] = {name: $real_name, email: $email, signingKey: $signingKey, gitdirs: $gitdirs}')
                    else
                      updated=$(echo "$current" | ${pkgs.jq}/bin/jq --arg name "$name" \
                        --arg real_name "$real_name" \
                        --arg email "$email" \
                        --arg signingKey "$signingKey" \
                        '.[$name] = {name: $real_name, email: $email, signingKey: $signingKey}')
                    fi

                    set_identities "$updated"
                  }

                  identity_add() {
                    local name="$1"
                    local real_name="$2"
                    local email="$3"
                    shift 3
                    local gitdirs=("$@")

                    # Check if GPG key already exists for this email
                    if ${pkgs.gnupg}/bin/gpg --list-secret-keys "$email" &>/dev/null; then
                      echo "GPG key for $email already exists. Use --import to add it."
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

                    KEY_ID=$(${pkgs.gnupg}/bin/gpg --list-keys --keyid-format long "$email" | grep "^pub" | sed 's|.*/||' | ${pkgs.gawk}/bin/awk '{print $1}')
                    echo "    Key ID: $KEY_ID"

                    echo ""
                    echo "==> Adding identity to git_identities..."
                    local gitdirs_json=""
                    if [ ''${#gitdirs[@]} -gt 0 ]; then
                      gitdirs_json=$(printf '%s\n' "''${gitdirs[@]}" | ${pkgs.jq}/bin/jq -R . | ${pkgs.jq}/bin/jq -s .)
                      echo "    Gitdirs: ''${gitdirs[*]}"
                    fi
                    upsert_identity "$name" "$real_name" "$email" "$KEY_ID" "$gitdirs_json"
                    echo "    Updated git_identities"

                    echo ""
                    echo "==> Adding GPG key to sops..."
                    EXPORTED_KEY=$(${pkgs.gnupg}/bin/gpg --export-secret-keys --armor "$email")
                    JSON_KEY=$(echo "$EXPORTED_KEY" | ${pkgs.jq}/bin/jq -Rs .)
                    ${pkgs.sops}/bin/sops set "$SECRETS_FILE" "[\"''${name}_gpg_key\"]" "$JSON_KEY"
                    echo "    Updated $SECRETS_FILE"

                    echo ""
                    echo "==> Running darwin-rebuild switch..."
                    sudo darwin-rebuild switch --flake "$FLAKE_ROOT"

                    echo ""
                    echo "Done! Identity '$name' has been added."
                  }

                  identity_regen_one() {
                    local name="$1"

                    # Get identity from git_identities
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

                    # Get old key fingerprint for deletion (if exists)
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

                    NEW_KEY_ID=$(${pkgs.gnupg}/bin/gpg --list-keys --keyid-format long "$email" | grep "^pub" | sed 's|.*/||' | ${pkgs.gawk}/bin/awk '{print $1}')
                    echo "    New Key ID: $NEW_KEY_ID"

                    # Update signingKey in git_identities
                    upsert_identity "$name" "$real_name" "$email" "$NEW_KEY_ID"
                    echo "    Updated git_identities"

                    # Update GPG key in sops
                    EXPORTED_KEY=$(${pkgs.gnupg}/bin/gpg --export-secret-keys --armor "$email")
                    JSON_KEY=$(echo "$EXPORTED_KEY" | ${pkgs.jq}/bin/jq -Rs .)
                    ${pkgs.sops}/bin/sops set "$SECRETS_FILE" "[\"''${name}_gpg_key\"]" "$JSON_KEY"
                    echo "    Updated sops secret"
                    echo ""
                  }

                  identity_regen() {
                    if [ $# -eq 0 ]; then
                      echo "Error: --regen requires at least one identity name"
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
                    local gitdirs=("$@")

                    echo "==> Importing existing GPG key for $name ($email)..."

                    # Verify key exists in keyring
                    if ! ${pkgs.gnupg}/bin/gpg --list-secret-keys "$email" &>/dev/null; then
                      echo "Error: No secret key found for $email"
                      exit 1
                    fi

                    KEY_ID=$(${pkgs.gnupg}/bin/gpg --list-keys --keyid-format long "$email" | grep "^pub" | sed 's|.*/||' | ${pkgs.gawk}/bin/awk '{print $1}')
                    echo "    Key ID: $KEY_ID"

                    echo ""
                    echo "==> Adding identity to git_identities..."
                    local gitdirs_json=""
                    if [ ''${#gitdirs[@]} -gt 0 ]; then
                      gitdirs_json=$(printf '%s\n' "''${gitdirs[@]}" | ${pkgs.jq}/bin/jq -R . | ${pkgs.jq}/bin/jq -s .)
                      echo "    Gitdirs: ''${gitdirs[*]}"
                    fi
                    upsert_identity "$name" "$real_name" "$email" "$KEY_ID" "$gitdirs_json"
                    echo "    Updated git_identities"

                    echo ""
                    echo "==> Adding GPG key to sops..."
                    EXPORTED_KEY=$(${pkgs.gnupg}/bin/gpg --export-secret-keys --armor "$email")
                    JSON_KEY=$(echo "$EXPORTED_KEY" | ${pkgs.jq}/bin/jq -Rs .)
                    ${pkgs.sops}/bin/sops set "$SECRETS_FILE" "[\"''${name}_gpg_key\"]" "$JSON_KEY"
                    echo "    Updated $SECRETS_FILE"

                    echo ""
                    echo "==> Running darwin-rebuild switch..."
                    sudo darwin-rebuild switch --flake "$FLAKE_ROOT"

                    echo ""
                    echo "Done! Identity '$name' has been imported."
                  }

                  identity_remove_one() {
                    local name="$1"

                    # Get identity from git_identities
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

                    # Remove from git_identities
                    local updated
                    updated=$(echo "$identities" | ${pkgs.jq}/bin/jq --arg name "$name" 'del(.[$name])')
                    set_identities "$updated"
                    echo "    Removed from git_identities"

                    # Remove GPG key from sops (if exists)
                    if ${pkgs.sops}/bin/sops -d --extract "[\"''${name}_gpg_key\"]" "$SECRETS_FILE" &>/dev/null; then
                      ${pkgs.sops}/bin/sops --set "[\"''${name}_gpg_key\"]" "null" "$SECRETS_FILE" 2>/dev/null || true
                      echo "    Removed GPG key from sops"
                    fi

                    echo ""
                  }

                  identity_remove() {
                    if [ $# -eq 0 ]; then
                      echo "Error: --remove requires at least one identity name"
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
                      (if .value.gitdirs then "\n    gitdirs: \(.value.gitdirs | join(", "))" else "" end) +
                      "\n"
                    '
                  }

                  identity_export() {
                    local email="$1"
                    ${pkgs.gnupg}/bin/gpg --export-secret-keys --armor "$email"
                  }

                  identity_pubkey() {
                    local query="$1"
                    local email=""

                    # Check if query is an identity name
                    local identities
                    identities=$(get_identities)

                    email=$(echo "$identities" | ${pkgs.jq}/bin/jq -r --arg q "$query" '
                      if .[$q] then .[$q].email
                      else to_entries[] | select(.value.email == $q) | .value.email // empty
                      end
                    ' | head -1)

                    if [ -z "$email" ]; then
                      # Try as direct email
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
                      --add)
                        shift
                        if [ $# -lt 3 ]; then
                          echo "Error: --add requires <name> <real_name> <email> [gitdirs...]"
                          exit 1
                        fi
                        identity_add "$@"
                        ;;
                      --regen)
                        shift
                        identity_regen "$@"
                        ;;
                      --import)
                        shift
                        if [ $# -lt 3 ]; then
                          echo "Error: --import requires <name> <real_name> <email> [gitdirs...]"
                          exit 1
                        fi
                        identity_import "$@"
                        ;;
                      --remove)
                        shift
                        identity_remove "$@"
                        ;;
                      --list)
                        identity_list
                        ;;
                      --export)
                        shift
                        if [ $# -lt 1 ]; then
                          echo "Error: --export requires <email>"
                          exit 1
                        fi
                        identity_export "$1"
                        ;;
                      --pubkey)
                        shift
                        if [ $# -lt 1 ]; then
                          echo "Error: --pubkey requires <name|email>"
                          exit 1
                        fi
                        identity_pubkey "$1"
                        ;;
                      --help|-h|"")
                        identity_usage
                        ;;
                      *)
                        echo "Unknown option: $1"
                        identity_usage
                        exit 1
                        ;;
                    esac
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
