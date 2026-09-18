{
  sops,
  gnupg,
  jq,
}:
let
  SOPS = "${sops}/bin/sops";
  GPG = "${gnupg}/bin/gpg";
  JQ = "${jq}/bin/jq";
in
''
  def normalize_gitdir [path: string] {
    $path | str replace $env.HOME "~" | str trim --right --char "/" | $"($in)/"
  }

  def get_identities [] {
    let result = (do { ^${SOPS} -d --extract '["git_identities"]' $env.SECRETS_FILE } | complete)
    if $result.exit_code == 0 {
      $result.stdout | from json
    } else {
      {}
    }
  }

  def set_identities [identities: record] {
    let json_string = ($identities | to json | ^${JQ} -Rs .)
    ^${SOPS} set $env.SECRETS_FILE '["git_identities"]' $json_string
  }

  def upsert_identity_record [
    name: string
    real_name: string
    email: string
    signing_key: string
    gitdirs: list<string>
    ssh_key: string
  ] {
    mut identities = get_identities
    mut obj = {name: $real_name, email: $email, signingKey: $signing_key}
    if ($gitdirs | length) > 0 {
      $obj = ($obj | upsert gitdirs $gitdirs)
    }
    if $ssh_key != "" {
      $obj = ($obj | upsert sshKey $ssh_key)
    }
    $identities = ($identities | upsert $name $obj)
    set_identities $identities
  }

  def extract_key_id [email: string] {
    let lines = (^${GPG} --list-keys --keyid-format long $email | lines | where { |l| $l | str starts-with "pub" })
    let last_pub = ($lines | last)
    let parts = ($last_pub | parse -r '.*/(\S+)')
    $parts | get 0.capture0
  }

  def store_ssh_key_in_sops [name: string, ssh_key_path: string] {
    let expanded = $ssh_key_path | str replace "~" $env.HOME
    if not ($expanded | path exists) {
      print $"Error: SSH key file not found: ($expanded)"
      exit 1
    }
    print $"    Storing SSH key in sops for ($name)..."
    let json_key = (open --raw $expanded | ^${JQ} -Rs .)
    ^${SOPS} set $env.SECRETS_FILE $"[\"($name)_ssh_key\"]" $json_key
  }

  def parse_extra_args [rest: list<string>] {
    mut gitdirs = []
    mut ssh_key = ""
    mut i = 0
    while $i < ($rest | length) {
      let arg = $rest | get $i
      if $arg == "--ssh-key" {
        $i = $i + 1
        $ssh_key = ($rest | get $i | str replace $"($env.HOME)/" "~/")
      } else {
        $gitdirs = ($gitdirs | append (normalize_gitdir $arg))
      }
      $i = $i + 1
    }
    {gitdirs: $gitdirs, ssh_key: $ssh_key}
  }

  def gpg_gen_key [real_name: string, email: string] {
    let batch = ([
      "Key-Type: RSA"
      "Key-Length: 4096"
      $"Name-Real: ($real_name)"
      $"Name-Email: ($email)"
      "Expire-Date: 0"
      "%no-protection"
    ] | str join "\n")
    let tmp = (^mktemp | str trim)
    $batch | save $tmp --force
    ^${GPG} --batch --gen-key $tmp
    rm $tmp
  }

  def identity_add [name: string, real_name: string, email: string, ...rest: string] {
    let parsed = parse_extra_args $rest

    let has_key = (do { ^${GPG} --list-secret-keys $email } | complete)
    if $has_key.exit_code == 0 {
      print $"GPG key for ($email) already exists. Use 'import' to add it."
      exit 1
    }

    print $"==> Generating GPG key for ($name) \(($email)\)..."
    gpg_gen_key $real_name $email

    let key_id = extract_key_id $email
    print $"    Key ID: ($key_id)"

    print ""
    print "==> Adding identity to git_identities..."
    if ($parsed.gitdirs | length) > 0 {
      print $"    Gitdirs: ($parsed.gitdirs | str join ' ')"
    }
    if $parsed.ssh_key != "" {
      print $"    SSH Key: ($parsed.ssh_key)"
    }
    upsert_identity_record $name $real_name $email $key_id $parsed.gitdirs $parsed.ssh_key
    print "    Updated git_identities"

    print ""
    print "==> Adding GPG key to sops..."
    let exported_key = (^${GPG} --export-secret-keys --armor $email)
    let json_key = ($exported_key | ^${JQ} -Rs .)
    ^${SOPS} set $env.SECRETS_FILE $"[\"($name)_gpg_key\"]" $json_key
    print $"    Updated ($env.SECRETS_FILE)"

    if $parsed.ssh_key != "" {
      store_ssh_key_in_sops $name $parsed.ssh_key
    }

    print ""
    print "==> Running darwin-rebuild switch..."
    ^sudo darwin-rebuild switch --flake $env.FLAKE_ROOT

    print ""
    print $"Done! Identity '($name)' has been added."
  }

  def identity_regen_one [name: string] {
    let identities = get_identities
    let identity = ($identities | get -o $name)

    if $identity == null {
      print $"Error: Identity '($name)' not found in git_identities."
      error make { msg: "identity not found" }
    }

    let real_name = $identity.name
    let email = $identity.email

    print $"==> Regenerating GPG key for ($name) \(($real_name) <($email)>\)..."

    let has_key = (do { ^${GPG} --list-secret-keys $email } | complete)
    if $has_key.exit_code == 0 {
      let fp_line = (^${GPG} --list-secret-keys --with-colons $email | lines | where { |l| $l | str starts-with "fpr" } | first)
      let old_fp = ($fp_line | split row ":" | get 9)
      print $"    Old fingerprint: ($old_fp)"
      print "    Deleting old key..."
      do { ^${GPG} --batch --yes --delete-secret-keys $old_fp } | complete
      do { ^${GPG} --batch --yes --delete-keys $old_fp } | complete
    } else {
      print "    No existing GPG key found, creating new one"
    }

    print "    Generating new GPG key..."
    gpg_gen_key $real_name $email

    let new_key_id = extract_key_id $email
    print $"    New Key ID: ($new_key_id)"

    upsert_identity_record $name $real_name $email $new_key_id [] ""
    print "    Updated git_identities"

    let exported_key = (^${GPG} --export-secret-keys --armor $email)
    let json_key = ($exported_key | ^${JQ} -Rs .)
    ^${SOPS} set $env.SECRETS_FILE $"[\"($name)_gpg_key\"]" $json_key
    print "    Updated sops secret"
    print ""
  }

  def identity_regen [...names: string] {
    if ($names | length) == 0 {
      print "Error: regen requires at least one identity name"
      exit 1
    }

    let results = ($names | each { |name|
      try { identity_regen_one $name; "ok" } catch { "fail" }
    })

    if ("fail" in $results) {
      print "Some identities failed to regenerate."
      exit 1
    }

    print "==> Running darwin-rebuild switch..."
    ^sudo darwin-rebuild switch --flake $env.FLAKE_ROOT

    print ""
    print $"Done! Regenerated: ($names | str join ' ')"
  }

  def identity_import_key [name: string, real_name: string, email: string, ...rest: string] {
    let parsed = parse_extra_args $rest

    print $"==> Importing existing GPG key for ($name) \(($email)\)..."

    let has_key = (do { ^${GPG} --list-secret-keys $email } | complete)
    if $has_key.exit_code != 0 {
      print $"Error: No secret key found for ($email)"
      exit 1
    }

    let key_id = extract_key_id $email
    print $"    Key ID: ($key_id)"

    print ""
    print "==> Adding identity to git_identities..."
    if ($parsed.gitdirs | length) > 0 {
      print $"    Gitdirs: ($parsed.gitdirs | str join ' ')"
    }
    if $parsed.ssh_key != "" {
      print $"    SSH Key: ($parsed.ssh_key)"
    }
    upsert_identity_record $name $real_name $email $key_id $parsed.gitdirs $parsed.ssh_key
    print "    Updated git_identities"

    print ""
    print "==> Adding GPG key to sops..."
    let exported_key = (^${GPG} --export-secret-keys --armor $email)
    let json_key = ($exported_key | ^${JQ} -Rs .)
    ^${SOPS} set $env.SECRETS_FILE $"[\"($name)_gpg_key\"]" $json_key
    print $"    Updated ($env.SECRETS_FILE)"

    if $parsed.ssh_key != "" {
      store_ssh_key_in_sops $name $parsed.ssh_key
    }

    print ""
    print "==> Running darwin-rebuild switch..."
    ^sudo darwin-rebuild switch --flake $env.FLAKE_ROOT

    print ""
    print $"Done! Identity '($name)' has been imported."
  }

  def identity_remove_one [name: string] {
    let identities = get_identities
    let identity = ($identities | get -o $name)

    if $identity == null {
      print $"Error: Identity '($name)' not found in git_identities."
      error make { msg: "identity not found" }
    }

    let email = $identity.email
    print $"==> Removing identity '($name)' \(($email)\)..."

    let updated = ($identities | reject $name)
    set_identities $updated
    print "    Removed from git_identities"

    let gpg_check = (do { ^${SOPS} -d --extract $"[\"($name)_gpg_key\"]" $env.SECRETS_FILE } | complete)
    if $gpg_check.exit_code == 0 {
      do { ^${SOPS} --set $"[\"($name)_gpg_key\"]" "null" $env.SECRETS_FILE } | complete
      print "    Removed GPG key from sops"
    }

    print ""
  }

  def identity_remove [...names: string] {
    if ($names | length) == 0 {
      print "Error: remove requires at least one identity name"
      exit 1
    }

    let results = ($names | each { |name|
      try { identity_remove_one $name; "ok" } catch { "fail" }
    })

    if ("fail" in $results) {
      print "Some identities failed to remove."
      exit 1
    }

    print "==> Running darwin-rebuild switch..."
    ^sudo darwin-rebuild switch --flake $env.FLAKE_ROOT

    print ""
    print $"Done! Removed: ($names | str join ' ')"
  }

  def identity_list [] {
    print "Git identities (from sops):"
    print ""
    let identities = get_identities

    for row in ($identities | transpose name data) {
      print $"  ($row.name):"
      print $"    name: ($row.data.name)"
      print $"    email: ($row.data.email)"
      print $"    signingKey: ($row.data.signingKey)"
      if "sshKey" in ($row.data | columns) {
        print $"    sshKey: ($row.data.sshKey)"
      }
      if "gitdirs" in ($row.data | columns) {
        print $"    gitdirs: ($row.data.gitdirs | str join ', ')"
      }
      print ""
    }
  }

  def identity_export [email: string] {
    ^${GPG} --export-secret-keys --armor $email
  }

  def identity_export_all [outdir: string] {
    mkdir $outdir

    let identities = get_identities

    let export_data = ($identities | transpose name data | reduce -f $identities { |row, acc|
      if "gitdirs" in ($row.data | columns) {
        $acc | upsert $row.name ($row.data | upsert gitdirs ($row.data.gitdirs | each { |d| $d | str replace $env.HOME "~" }))
      } else {
        $acc
      }
    })
    $export_data | to json | save $"($outdir)/identities.json" --force
    print "==> Exported identities.json"

    for row in ($identities | transpose name data) {
      let gpg_result = (do { ^${SOPS} -d --extract $"[\"($row.name)_gpg_key\"]" $env.SECRETS_FILE } | complete)
      if $gpg_result.exit_code == 0 and $gpg_result.stdout != "" {
        $gpg_result.stdout | save $"($outdir)/($row.name).gpg" --force
        print $"    Exported ($row.name).gpg"
      } else {
        print $"    Warning: No GPG key found in sops for '($row.name)', skipping"
      }

      let ssh_result = (do { ^${SOPS} -d --extract $"[\"($row.name)_ssh_key\"]" $env.SECRETS_FILE } | complete)
      if $ssh_result.exit_code == 0 and $ssh_result.stdout != "" {
        $ssh_result.stdout | save $"($outdir)/($row.name).ssh" --force
        print $"    Exported ($row.name).ssh"
      }
    }

    print ""
    print $"Done! Exported all identities to ($outdir)"
  }

  def identity_import_all [indir: string] {
    let id_file = $"($indir)/identities.json"
    if not ($id_file | path exists) {
      print $"Error: ($id_file) not found"
      exit 1
    }

    let identities = open $id_file

    print "==> Importing all GPG keys into keyring..."
    for row in ($identities | transpose name data) {
      let gpg_file = $"($indir)/($row.name).gpg"
      if ($gpg_file | path exists) {
        let email = $row.data.email
        print $"    Importing ($row.name).gpg..."
        do { ^${GPG} --batch --import $gpg_file } | complete
        let fp_lines = (^${GPG} --list-keys --with-colons $email | lines | where { |l| $l | str starts-with "fpr" })
        if ($fp_lines | length) > 0 {
          let key_fp = ($fp_lines | first | split row ":" | get 9)
          $"($key_fp):6:\n" | ^${GPG} --import-ownertrust
        }
        print $"    Trusted ($row.name) \(($email)\)"
      } else {
        print $"    Warning: No GPG key file for '($row.name)', skipping"
      }
    }

    print ""
    print "==> Storing identities and keys in sops..."
    for row in ($identities | transpose name data) {
      let real_name = $row.data.name
      let email = $row.data.email
      let signing_key = $row.data.signingKey
      let ssh_key = ($row.data | get -o sshKey | default "")
      let gitdirs = if "gitdirs" in ($row.data | columns) {
        $row.data.gitdirs | each { |d| $d | str replace $env.HOME "~" }
      } else {
        []
      }

      let gpg_file = $"($indir)/($row.name).gpg"
      if ($gpg_file | path exists) {
        print $"    Storing GPG key in sops for ($row.name)..."
        let json_key = (open --raw $gpg_file | ^${JQ} -Rs .)
        ^${SOPS} set $env.SECRETS_FILE $"[\"($row.name)_gpg_key\"]" $json_key
      }

      let ssh_file = $"($indir)/($row.name).ssh"
      if ($ssh_file | path exists) {
        print $"    Storing SSH key in sops for ($row.name)..."
        let json_ssh = (open --raw $ssh_file | ^${JQ} -Rs .)
        ^${SOPS} set $env.SECRETS_FILE $"[\"($row.name)_ssh_key\"]" $json_ssh
      }

      print $"    Upserting identity ($row.name)..."
      upsert_identity_record $row.name $real_name $email $signing_key $gitdirs $ssh_key
    }

    print ""
    print "==> Running darwin-rebuild switch..."
    ^sudo darwin-rebuild switch --flake $env.FLAKE_ROOT

    print ""
    print $"Done! Imported all identities from ($indir)"
  }

  def identity_sync [] {
    let identities = get_identities

    print "==> Syncing GPG and SSH keys from sops to local..."
    for row in ($identities | transpose name data) {
      let email = $row.data.email

      let gpg_result = (do { ^${SOPS} -d --extract $"[\"($row.name)_gpg_key\"]" $env.SECRETS_FILE } | complete)
      if $gpg_result.exit_code == 0 and $gpg_result.stdout != "" {
        $gpg_result.stdout | ^${GPG} --batch --import
        let fp_lines = (^${GPG} --list-keys --with-colons $email | lines | where { |l| $l | str starts-with "fpr" })
        if ($fp_lines | length) > 0 {
          let key_fp = ($fp_lines | first | split row ":" | get 9)
          $"($key_fp):6:\n" | ^${GPG} --import-ownertrust
        }
        print $"    Synced GPG key for ($row.name) \(($email)\)"
      }

      let ssh_key_path = ($row.data | get -o sshKey | default "")
      if $ssh_key_path != "" {
        let expanded = $ssh_key_path | str replace "~" $env.HOME
        let ssh_result = (do { ^${SOPS} -d --extract $"[\"($row.name)_ssh_key\"]" $env.SECRETS_FILE } | complete)
        if $ssh_result.exit_code == 0 and $ssh_result.stdout != "" {
          mkdir ($expanded | path dirname)
          $ssh_result.stdout | save $expanded --force
          ^chmod 600 $expanded
          print $"    Synced SSH key for ($row.name) -> ($ssh_key_path)"
        }
      }
    }

    print ""
    print "Done!"
  }

  def identity_set_field [name: string, ...rest: string] {
    let identities = get_identities
    let identity = ($identities | get -o $name)

    if $identity == null {
      print $"Error: Identity '($name)' not found."
      exit 1
    }

    mut updated = $identities
    mut i = 0
    while $i < ($rest | length) {
      let arg = $rest | get $i
      match $arg {
        "--ssh-key" => {
          $i = $i + 1
          let raw_path = $rest | get $i
          let ssh_key = ($raw_path | str replace $"($env.HOME)/" "~/")
          $updated = ($updated | upsert $name ($updated | get $name | upsert sshKey $ssh_key))
          store_ssh_key_in_sops $name $raw_path
          print $"    Set sshKey=($ssh_key) for ($name)"
        }
        _ => {
          print $"Error: Unknown option '($arg)' for set"
          exit 1
        }
      }
      $i = $i + 1
    }

    set_identities $updated

    print ""
    print "==> Running darwin-rebuild switch..."
    ^sudo darwin-rebuild switch --flake $env.FLAKE_ROOT

    print ""
    print $"Done! Updated identity '($name)'."
  }

  def identity_pubkey [query: string] {
    let identities = get_identities
    mut email = ""

    let by_name = ($identities | get -o $query)
    if $by_name != null {
      $email = $by_name.email
    } else {
      let matches = ($identities | transpose name data | where { |r| $r.data.email == $query })
      if ($matches | length) > 0 {
        $email = ($matches | first).data.email
      }
    }

    if $email == "" {
      let gpg_check = (do { ^${GPG} --list-keys $query } | complete)
      if $gpg_check.exit_code == 0 {
        $email = $query
      } else {
        print -e $"Error: No identity or GPG key found for '($query)'"
        exit 1
      }
    }

    ^${GPG} --export --armor $email
  }

  def cmd_identity_dispatch [...args: string] {
    let first = ($args | get -o 0 | default "")
    let rest = if ($args | length) > 1 { $args | skip 1 } else { [] }
    match $first {
      "add" => {
        if ($rest | length) < 3 {
          print "Error: add requires <name> <real_name> <email> [gitdirs...]"
          exit 1
        }
        identity_add ($rest | get 0) ($rest | get 1) ($rest | get 2) ...($rest | skip 3)
      }
      "regen" => { identity_regen ...$rest }
      "import" => {
        if ($rest | length) < 3 {
          print "Error: import requires <name> <real_name> <email> [gitdirs...]"
          exit 1
        }
        identity_import_key ($rest | get 0) ($rest | get 1) ($rest | get 2) ...($rest | skip 3)
      }
      "set" => {
        if ($rest | length) < 2 {
          print "Error: set requires <name> and at least one option (e.g. --ssh-key <path>)"
          exit 1
        }
        identity_set_field ($rest | get 0) ...($rest | skip 1)
      }
      "remove" => { identity_remove ...$rest }
      "sync" => { identity_sync }
      "list" => { identity_list }
      "export" => {
        if ($rest | length) < 1 { print "Error: export requires <email>"; exit 1 }
        identity_export ($rest | first)
      }
      "export-all" => {
        if ($rest | length) < 1 { print "Error: export-all requires <dir>"; exit 1 }
        identity_export_all ($rest | first)
      }
      "import-all" => {
        if ($rest | length) < 1 { print "Error: import-all requires <dir>"; exit 1 }
        identity_import_all ($rest | first)
      }
      "pubkey" => {
        if ($rest | length) < 1 { print "Error: pubkey requires <name|email>"; exit 1 }
        identity_pubkey ($rest | first)
      }
      "help" | "-h" | "" => { identity_usage }
      _ => {
        print $"Unknown command: ($first)"
        identity_usage
        exit 1
      }
    }
  }

  def identity_usage [] {
    print "Usage: universe identity <command> [options]"
    print ""
    print "Commands:"
    print "  add <name> <real_name> <email> [gitdirs...] [--ssh-key <path>]    Add new identity (generate GPG key)"
    print "  regen <name> [name2...]                                            Regenerate GPG key(s) for existing identity"
    print "  import <name> <real_name> <email> [gitdirs...] [--ssh-key <path>]  Import existing GPG key as identity"
    print "  set <name> [--ssh-key <path>]                                      Update an existing identity"
    print "  remove <name> [name2...]                                           Remove identity from sops"
    print "  sync                                                               Sync GPG and SSH keys from sops to local"
    print "  list                                                               List identities from sops"
    print "  export <email>                                                     Export secret GPG key for email"
    print "  export-all <dir>                                                   Export all identities and GPG keys to directory"
    print "  import-all <dir>                                                   Import all identities and GPG keys from directory"
    print "  pubkey <name|email>                                                Export public GPG key by identity or email"
    print ""
    print "Examples:"
    print "  universe identity add myid 'My Name' 'me@example.com'"
    print "  universe identity add myid 'My Name' 'me@example.com' ~/projects/ ~/work/"
    print "  universe identity regen myid"
    print "  universe identity remove myid"
    print "  universe identity import myid 'My Name' 'me@example.com' ~/code/"
    print "  universe identity add work 'My Name' 'me@work.com' ~/work/ --ssh-key ~/.ssh/id_work"
    print "  universe identity set rocks --ssh-key ~/.ssh/id_rocks"
    print "  universe identity pubkey myid"
    print "  universe identity pubkey me@example.com"
    print "  universe identity export-all ./backup"
    print "  universe identity import-all ./backup"
  }
''
