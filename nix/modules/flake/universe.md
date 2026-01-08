# Universe CLI

A command-line tool for managing this nix configuration.

## Installation

```bash
nix run .#universe -- --help
```

## Commands

### identity

Manage GPG identities for git signing. Identities are stored encrypted in sops.

#### --add

Generate a new GPG key and add identity to sops.

```bash
universe identity --add <name> <real_name> <email> [gitdirs...]
```

**Examples:**
```bash
# Basic (gitdir derived from email domain)
universe identity --add myid "My Name" "me@example.com"

# With custom gitdirs
universe identity --add myid "My Name" "me@example.com" ~/projects/ ~/work/
```

**What it does:**
1. Generates a new RSA 4096 GPG key
2. Adds identity to `git_identities` in sops (with optional gitdirs)
3. Adds GPG key to sops
4. Runs darwin-rebuild switch

#### --import

Import an existing GPG key from your keyring into sops.

```bash
universe identity --import <name> <real_name> <email> [gitdirs...]
```

**Examples:**
```bash
# Basic (gitdir derived from email domain)
universe identity --import myid "My Name" "me@example.com"

# With custom gitdirs
universe identity --import myid "My Name" "me@example.com" ~/code/ ~/projects/
```

**What it does:**
1. Verifies the key exists in your GPG keyring
2. Adds identity to `git_identities` in sops (with optional gitdirs)
3. Adds GPG key to sops
4. Runs darwin-rebuild switch

#### --regen

Regenerate GPG key(s) for existing identities.

```bash
universe identity --regen <name> [name2...]
```

**Examples:**
```bash
# Single identity
universe identity --regen myid

# Multiple identities at once
universe identity --regen id1 id2 id3
```

**What it does (for each identity):**
1. Reads name/email from `git_identities` in sops
2. Deletes old GPG key from keyring (if exists)
3. Generates new RSA 4096 GPG key
4. Updates signingKey in `git_identities`
5. Updates GPG key in sops
6. Runs darwin-rebuild switch (once, after all)

#### --remove

Remove identity from sops.

```bash
universe identity --remove <name> [name2...]
```

**Examples:**
```bash
# Single identity
universe identity --remove myid

# Multiple identities
universe identity --remove id1 id2
```

**What it does:**
1. Removes identity from `git_identities` in sops
2. Removes GPG key from sops (if exists)
3. Runs darwin-rebuild switch

#### --list

List all identities from sops.

```bash
universe identity --list
```

#### --export

Export a GPG key by email.

```bash
universe identity --export <email>
```

## How It Works

Identities are stored in `secrets/secret.yaml` as encrypted JSON:

```yaml
git_identities: |
  {
    "work": {"name": "...", "email": "...", "signingKey": "..."},
    "personal": {"name": "...", "email": "...", "signingKey": "...", "gitdirs": ["~/code/", "~/projects/"]}
  }
```

During home-manager activation:
1. Identities are decrypted from sops
2. Gitdir directories are created (from `gitdirs` array or derived from email domain)
3. Gitconfig files are generated in `~/.config/git/config.d/`
4. Include directives are generated in `~/.config/git/identities.gitconfig`

**Gitdir rules:**
- If `gitdirs` array is specified, those directories are used
- Otherwise, email domain becomes the directory: `user@example.com` → `~/example/`

## Extending Universe

To add new commands, edit `nix/modules/flake/universe.nix`:

1. Add a new usage function: `newcmd_usage()`
2. Add command functions: `newcmd_action()`
3. Add case in `cmd_newcmd()`
4. Add case in main switch for `newcmd)`
