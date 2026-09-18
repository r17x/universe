{ }:
''
  def universe_dir [] { $"($env.HOME)/.universe" }
  def manifest_path [] { $"($env.HOME)/.universe/manifest.json" }
  def state_path [] { $"($env.HOME)/.universe/state.json" }

  const APPLY_ORDER = [
    "terminal.tmux"
    "desktop.sketchybar"
    "desktop.jankyborders"
    "terminal.ghostty"
    "shell.fish"
  ]

  def write_state [data: record] {
    let tmp = $"((state_path)).tmp.($nu.pid)"
    $data | to json | save $tmp --force
    mv $tmp (state_path)
  }

  def ensure_manifest [] {
    if not ((manifest_path) | path exists) {
      print $"No manifest found at ((manifest_path))"
      print "Run 'universe rebuild' to generate the runtime manifest."
      exit 1
    }
  }

  def ensure_state [] {
    if not ((state_path) | path exists) {
      let manifest = open (manifest_path)
      write_state {theme: $manifest.default_theme, profiles: {}, overrides: {}}
    }
    let state = open (state_path)
    if "profiles" not-in ($state | columns) {
      write_state ($state | upsert profiles {})
    }
  }

  def reconcile_state [] {
    let manifest = open (manifest_path)
    mut state = open (state_path)

    if $manifest.version != 1 {
      print $"manifest version ($manifest.version) not supported, rebuild required"
      exit 1
    }

    let theme_names = $manifest.themes | columns
    if $state.theme not-in $theme_names {
      print $"notice: theme '($state.theme)' no longer available, falling back to '($manifest.default_theme)'"
      $state = ($state | upsert theme $manifest.default_theme)
      write_state $state
    }

    let aspect_names = $manifest.aspects | columns
    let stale_overrides = ($state.overrides | columns | where { |k| $k not-in $aspect_names })
    if ($stale_overrides | length) > 0 {
      for s in $stale_overrides {
        print $"notice: dropping override for removed aspect '($s)'"
      }
      $state = ($stale_overrides | reduce -f $state { |s, acc| $acc | update overrides ($acc.overrides | reject $s) })
      write_state $state
    }

    let current_state = $state
    let stale_profiles = ($current_state.profiles | columns | where { |aspect|
      let aspect_data = ($manifest.aspects | get -o $aspect)
      if $aspect_data == null {
        true
      } else if "profiles" not-in ($aspect_data | columns) {
        true
      } else {
        let profile = ($current_state.profiles | get $aspect)
        $profile not-in $aspect_data.profiles
      }
    })
    if ($stale_profiles | length) > 0 {
      for s in $stale_profiles {
        let aspect_data = ($manifest.aspects | get -o $s)
        if $aspect_data == null or ("profiles" not-in ($aspect_data | columns)) {
          print $"notice: dropping profile for aspect '($s)' \(no longer declares profiles\)"
        } else {
          let profile = ($state.profiles | get $s)
          print $"notice: dropping profile '($profile)' for '($s)' \(no longer available\)"
        }
      }
      $state = ($stale_profiles | reduce -f $state { |s, acc| $acc | update profiles ($acc.profiles | reject $s) })
      write_state $state
    }
  }

  def resolve_variant_key [aspect: string, theme: string] {
    let manifest = open (manifest_path)
    let aspect_data = $manifest.aspects | get $aspect
    if "profiles" in ($aspect_data | columns) {
      let state = open (state_path)
      let profile = ($state.profiles | get -o $aspect | default $aspect_data.default_profile)
      $"($profile).($theme)"
    } else {
      $theme
    }
  }

  def apply_aspect [aspect: string, variant_key: string] {
    let manifest = open (manifest_path)
    let aspect_data = $manifest.aspects | get $aspect

    match $aspect_data.mechanism {
      "prebuilt-swap" => {
        let variant = $aspect_data.variants | get $variant_key
        let target = ($aspect_data | get -o target | default "")
        if $target != "" {
          let expanded = $target | str replace "~" $env.HOME
          mkdir ($expanded | path dirname)
          ^ln -sf $variant $expanded
        }
        let applicator = ($aspect_data | get -o applicator | default null)
        if $applicator != null {
          let resolved = $applicator | str replace '{variant}' $variant
          ^bash -c $resolved
        }
      }
      "command-dispatch" => {
        let values = $aspect_data.values | get $variant_key
        let commands = $aspect_data.commands
        $commands | transpose prop cmd_template | each { |row|
          let value = $values | get $row.prop
          let cmd = $row.cmd_template | str replace '{value}' $value
          ^bash -c $cmd
        }
        null
      }
    }
  }

  def apply_one [aspect: string, theme: string] {
    let variant_key = resolve_variant_key $aspect $theme
    try {
      apply_aspect $aspect $variant_key
      print $"  (ansi green)●(ansi reset) ($aspect | fill -w 24) (ansi cyan)($variant_key)(ansi reset)"
    } catch { |err|
      let reason = ($err.msg? | default "skipped")
      print $"  (ansi default_dimmed)○(ansi reset) ($aspect | fill -w 24) (ansi default_dimmed)($variant_key)(ansi reset) (ansi yellow)\(($reason)\)(ansi reset)"
    }
  }

  def apply_all_aspects [theme: string, overrides: record] {
    let manifest = open (manifest_path)
    let manifest_aspects = $manifest.aspects | columns

    for aspect in $APPLY_ORDER {
      if $aspect in $manifest_aspects {
        let effective_theme = if $aspect in ($overrides | columns) { $overrides | get $aspect } else { $theme }
        apply_one $aspect $effective_theme
      }
    }

    for aspect in $manifest_aspects {
      if $aspect not-in $APPLY_ORDER {
        let effective_theme = if $aspect in ($overrides | columns) { $overrides | get $aspect } else { $theme }
        apply_one $aspect $effective_theme
      }
    }
  }

  def "cmd_switch theme" [name: string] {
    ensure_manifest
    ensure_state

    let manifest = open (manifest_path)
    let theme_names = $manifest.themes | columns
    if $name not-in $theme_names {
      print $"Error: theme '($name)' not found"
      print $"Available themes: ($theme_names | str join ', ')"
      exit 1
    }

    reconcile_state
    let state = open (state_path)
    let current_overrides = ($state | get -o overrides | default {})
    let current_profiles = ($state | get -o profiles | default {})
    write_state {theme: $name, profiles: $current_profiles, overrides: $current_overrides}
    print $"  (ansi default_dimmed)Switching to (ansi attr_bold)($name)(ansi reset)"
    apply_all_aspects $name $current_overrides
  }

  def "cmd_switch profile" [name: string] {
    ensure_manifest
    ensure_state
    reconcile_state

    let manifest = open (manifest_path)
    mut profile_set = false

    for aspect in ($manifest.aspects | columns) {
      let aspect_data = $manifest.aspects | get $aspect
      if "profiles" in ($aspect_data | columns) {
        if $name in $aspect_data.profiles {
          mut state = open (state_path)
          $state = ($state | upsert profiles ($state.profiles | upsert $aspect $name))
          write_state $state

          let theme = $state.theme
          let override = ($state.overrides | get -o $aspect | default null)
          let effective_theme = if $override != null { $override } else { $theme }
          print $"  (ansi default_dimmed)Setting profile: (ansi attr_bold)($aspect)(ansi reset) → (ansi cyan)($name)(ansi reset)"
          apply_one $aspect $effective_theme
          $profile_set = true
        }
      }
    }

    if not $profile_set {
      let all_profiles = ($manifest.aspects | transpose name data | where { |r| "profiles" in ($r.data | columns) } | each { |r| $r.data.profiles } | flatten | uniq | str join ", ")
      print $"Error: profile '($name)' not found in any aspect"
      print $"Available profiles: ($all_profiles)"
      exit 1
    }
  }

  def "cmd_switch reset" [] {
    ensure_manifest
    ensure_state
    reconcile_state

    let state = open (state_path)
    let theme = $state.theme
    let current_profiles = ($state | get -o profiles | default {})
    write_state {theme: $theme, profiles: $current_profiles, overrides: {}}
    print $"  (ansi default_dimmed)Resetting overrides, re-applying (ansi attr_bold)($theme)(ansi reset)"
    apply_all_aspects $theme {}
  }

  def "cmd_switch aspect" [aspect: string, variant: string] {
    ensure_manifest
    ensure_state

    let manifest = open (manifest_path)
    if $aspect not-in ($manifest.aspects | columns) {
      print $"Error: aspect '($aspect)' not found"
      print $"Available aspects: ($manifest.aspects | columns | str join ', ')"
      exit 1
    }
    if $variant not-in ($manifest.themes | columns) {
      print $"Error: theme '($variant)' not found"
      print $"Available themes: ($manifest.themes | columns | str join ', ')"
      exit 1
    }

    reconcile_state
    let state = open (state_path)
    let updated = $state | upsert overrides ($state.overrides | upsert $aspect $variant)
    write_state $updated
    print $"  (ansi default_dimmed)Override (ansi attr_bold)($aspect)(ansi reset)"
    apply_one $aspect $variant
  }

  def "cmd_state show" [] {
    ensure_manifest
    ensure_state
    reconcile_state

    let state = open (state_path)
    let manifest = open (manifest_path)
    let theme = $state.theme
    let default_theme = $manifest.default_theme
    let overrides = ($state | get -o overrides | default {})
    let profiles = ($state | get -o profiles | default {})
    let aspect_count = $manifest.aspects | columns | length

    let default_label = if $theme == $default_theme { $" (ansi default_dimmed)\(default\)(ansi reset)" } else { "" }
    print $"  (ansi default_dimmed)Theme(ansi reset)     (ansi attr_bold)($theme)(ansi reset)($default_label)"
    print $"  (ansi default_dimmed)Aspects(ansi reset)   ($aspect_count) runtime-enabled"

    if ($profiles | columns | length) > 0 {
      print $"  (ansi default_dimmed)Profiles(ansi reset)"
      for row in ($profiles | transpose k v) {
        print $"    (ansi cyan)●(ansi reset) ($row.k | fill -w 22) (ansi attr_bold)($row.v)(ansi reset)"
      }
    }

    if ($overrides | columns | length) > 0 {
      print $"  (ansi default_dimmed)Overrides(ansi reset)"
      for row in ($overrides | transpose k v) {
        print $"    (ansi yellow)●(ansi reset) ($row.k | fill -w 22) (ansi cyan)($row.v)(ansi reset)"
      }
    }
  }

  def "cmd_state sync" [] {
    ensure_manifest
    ensure_state
    reconcile_state

    let state = open (state_path)
    let theme = $state.theme
    let overrides = ($state | get -o overrides | default {})
    print $"  (ansi default_dimmed)Syncing (ansi attr_bold)($theme)(ansi reset)"
    apply_all_aspects $theme $overrides
  }

  def cmd_switch_dispatch [...args: string] {
    let first = ($args | get -o 0 | default "")
    match $first {
      "theme" => {
        let name = ($args | get -o 1 | default "")
        if $name == "" {
          ensure_manifest
          let manifest = open (manifest_path)
          print "Usage: universe switch theme <name>"
          print $"Available themes: ($manifest.themes | columns | str join ', ')"
          exit 1
        }
        cmd_switch theme $name
      }
      "profile" => {
        let name = ($args | get -o 1 | default "")
        if $name == "" {
          ensure_manifest
          let manifest = open (manifest_path)
          let all_profiles = ($manifest.aspects | transpose name data | where { |r| "profiles" in ($r.data | columns) } | each { |r| $r.data.profiles } | flatten | uniq | str join ", ")
          print "Usage: universe switch profile <name>"
          print $"Available profiles: ($all_profiles)"
          exit 1
        }
        cmd_switch profile $name
      }
      "reset" => { cmd_switch reset }
      "help" | "-h" | "--help" => {
        ensure_manifest
        let manifest = open (manifest_path)
        print "Usage: universe switch <command>"
        print ""
        print "Commands:"
        print "  theme <name>        Switch all aspects to a theme"
        print "  profile <name>      Switch style profile (e.g. default, hairline, hairline-color)"
        print "  <aspect> <theme>    Override a single aspect"
        print "  reset               Clear overrides, re-apply current theme (preserves profiles)"
        print ""
        print $"Available themes: ($manifest.themes | columns | str join ', ')"
        print $"Available aspects: ($manifest.aspects | columns | str join ', ')"
      }
      "" => {
        print "Usage: universe switch <theme|profile|reset|aspect> [args]"
        print "Run 'universe switch help' for details."
        exit 1
      }
      _ => {
        let aspect = $first
        let variant = ($args | get -o 1 | default "")
        if $variant == "" {
          print "Usage: universe switch <aspect> <theme>"
          exit 1
        }
        cmd_switch aspect $aspect $variant
      }
    }
  }

  def cmd_state_dispatch [...args: string] {
    let first = ($args | get -o 0 | default "")
    match $first {
      "sync" => { cmd_state sync }
      "show" | "" => { cmd_state show }
      "help" | "-h" | "--help" => {
        print "Usage: universe state <command>"
        print ""
        print "Commands:"
        print "  show    Show current theme, profiles, and overrides (default)"
        print "  sync    Re-apply current state to all aspects"
      }
    }
  }
''
