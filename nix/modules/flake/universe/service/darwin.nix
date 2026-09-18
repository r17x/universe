''
  def launchctl_field [output: string, pattern: string, regex: string] {
    let matches = ($output | lines | where { |l| $l =~ $pattern })
    if ($matches | length) == 0 {
      ""
    } else {
      let parsed = ($matches | get 0 | parse -r $regex)
      if ($parsed | length) == 0 { "" } else { $parsed | get 0.capture0 | default "" }
    }
  }

  def resolve_service [name: string] {
    let label = if ($name | str contains ".") { $name } else { $"org.nixos.($name)" }

    let try_domains = [
      $"system/($label)"
      $"gui/(^id -u | str trim)/($label)"
    ]

    for domain in $try_domains {
      let result = (do { ^launchctl print $domain } | complete)
      if $result.exit_code == 0 {
        return $domain
      }
    }

    error make { msg: $"Service '($name)' not found" }
  }

  def needs_sudo [domain: string] {
    $domain | str starts-with "system/"
  }

  def parse_service_line [line: string, show_all: bool, scope: string] {
    let parts = ($line | str trim | split row -r '\s+')
    if ($parts | length) < 3 {
      return {}
    }
    let pid = $parts.0
    let status = $parts.1
    let label = ($parts | skip 2 | str join " ")

    if not $show_all and not ($label | str starts-with "org.nixos.") {
      return {}
    }

    let category = if ($label | str starts-with "org.nixos.") {
      "nix"
    } else if ($label | str starts-with "com.apple.") {
      "apple"
    } else {
      "other"
    }

    let is_running = $pid != "0" and $pid != "-"
    let state = if $is_running { "running" } else { "stopped" }
    let indicator = if $is_running { "●" } else { "○" }
    let state_color = if $is_running { (ansi green) } else { (ansi default_dimmed) }

    let display_name = if ($label | str starts-with "org.nixos.") {
      $label | str replace "org.nixos." ""
    } else {
      $label
    }

    let scope_color = if $scope == "user" { (ansi yellow) } else { (ansi cyan) }
    let type_color = if $category == "nix" {
      (ansi green)
    } else if $category == "apple" {
      (ansi default_dimmed)
    } else {
      (ansi reset)
    }

    {
      line: $"  ($state_color)($indicator)(ansi reset) ($display_name | fill -w 20) ($scope_color)($scope | fill -w 6)(ansi reset) ($type_color)($category | fill -w 5)(ansi reset) ($pid | fill -a right -w 6)  ($state_color)($state)(ansi reset)"
      state: $state
    }
  }

  def service_list [...flags: string] {
    mut show_all = false
    mut filter_running = false
    mut filter_stopped = false
    mut show_system = true
    mut show_user = true

    for flag in $flags {
      match $flag {
        "--all" => { $show_all = true }
        "--running" => { $filter_running = true }
        "--stopped" => { $filter_stopped = true }
        "--system" => { $show_user = false }
        "--user" => { $show_system = false }
        _ => {
          print $"Unknown option: ($flag)"
          service_usage
          exit 1
        }
      }
    }

    let show_all = $show_all
    let filter_running = $filter_running
    let filter_stopped = $filter_stopped
    let show_system = $show_system
    let show_user = $show_user

    print $"  (ansi attr_bold)($"NAME" | fill -w 22) ($"SCOPE" | fill -w 6) ($"TYPE" | fill -w 5) ($"PID" | fill -a right -w 6)  STATE(ansi reset)"
    print $"  (ansi default_dimmed)($"----" | fill -w 22) ($"-----" | fill -w 6) ($"----" | fill -w 5) ($"---" | fill -a right -w 6)  -----(ansi reset)"

    if $show_system {
      let system_output = (do { ^launchctl print system } | complete)
      if $system_output.exit_code == 0 {
        for line in ($system_output.stdout | lines | where { |line| $line =~ '^\s+[0-9-]+\s+' and "subdomains" not-in $line }) {
          let parsed = parse_service_line $line $show_all "system"
          if ($parsed | columns | length) > 0 and ($parsed | get -o line | default "") != "" {
            if $filter_running and $parsed.state != "running" { } else if $filter_stopped and $parsed.state != "stopped" { } else { print $parsed.line }
          }
        }
      }
    }

    if $show_user {
      let uid = (^id -u | str trim)
      let user_output = (do { ^launchctl print $"gui/($uid)" } | complete)
      if $user_output.exit_code == 0 {
        for line in ($user_output.stdout | lines | where { |line| $line =~ '^\s+[0-9-]+\s+' and "subdomains" not-in $line }) {
          let parsed = parse_service_line $line $show_all "user"
          if ($parsed | columns | length) > 0 and ($parsed | get -o line | default "") != "" {
            if $filter_running and $parsed.state != "running" { } else if $filter_stopped and $parsed.state != "stopped" { } else { print $parsed.line }
          }
        }
      }
    }
  }

  def service_start [name: string] {
    let domain = resolve_service $name
    let label = $domain | str replace -r '^[^/]+/' ""

    print $"Starting ($name)..."
    if (needs_sudo $domain) {
      let plist = $"/Library/LaunchDaemons/($label).plist"
      let result = (do { ^sudo launchctl bootstrap system $plist } | complete)
      if $result.exit_code != 0 {
        ^sudo launchctl kickstart $domain
      }
    } else {
      let uid = (^id -u | str trim)
      let plist = $"($env.HOME)/Library/LaunchAgents/($label).plist"
      let result = (do { ^launchctl bootstrap $"gui/($uid)" $plist } | complete)
      if $result.exit_code != 0 {
        ^launchctl kickstart $domain
      }
    }

    sleep 200ms
    let info = (do { ^launchctl print $domain } | complete)
    let pid = (launchctl_field $info.stdout 'pid = ' 'pid = (\d+)')
    let state = (launchctl_field $info.stdout 'state = ' 'state = (\w+)')

    if $state == "running" and $pid != "" {
      print $"(ansi green)✓(ansi reset) ($name) running \(PID ($pid)\)"
    } else {
      print $"(ansi red)✗(ansi reset) ($name) failed to start \(state: ($state)\)"
      exit 1
    }
  }

  def service_stop [name: string] {
    let domain = resolve_service $name

    print $"Stopping ($name)..."
    if (needs_sudo $domain) {
      ^sudo launchctl kill SIGTERM $domain
    } else {
      ^launchctl kill SIGTERM $domain
    }

    sleep 200ms
    let info = (do { ^launchctl print $domain } | complete)
    let state = (launchctl_field $info.stdout 'state = ' 'state = (\w+)')

    if $state != "running" {
      print $"(ansi green)✓(ansi reset) ($name) stopped"
    } else {
      print $"(ansi red)✗(ansi reset) ($name) still running"
      exit 1
    }
  }

  def service_restart [name: string] {
    let domain = resolve_service $name
    let label = $domain | str replace -r '^[^/]+/' ""

    print $"Restarting ($name)..."

    if (needs_sudo $domain) {
      let plist = $"/Library/LaunchDaemons/($label).plist"
      do { ^sudo launchctl kill SIGTERM $domain } | complete
      sleep 300ms
      let result = (do { ^sudo launchctl kickstart $domain } | complete)
      if $result.exit_code != 0 {
        ^sudo launchctl bootstrap system $plist
      }
    } else {
      let uid = (^id -u | str trim)
      let plist = $"($env.HOME)/Library/LaunchAgents/($label).plist"
      do { ^launchctl kill SIGTERM $domain } | complete
      sleep 300ms
      let result = (do { ^launchctl kickstart $domain } | complete)
      if $result.exit_code != 0 {
        ^launchctl bootstrap $"gui/($uid)" $plist
      }
    }

    sleep 200ms
    let info = (do { ^launchctl print $domain } | complete)
    let pid = (launchctl_field $info.stdout 'pid = ' 'pid = (\d+)')
    let state = (launchctl_field $info.stdout 'state = ' 'state = (\w+)')

    if $state == "running" and $pid != "" {
      print $"(ansi green)✓(ansi reset) ($name) running \(PID ($pid)\)"
    } else {
      print $"(ansi red)✗(ansi reset) ($name) failed to restart \(state: ($state)\)"
      exit 1
    }
  }

  def service_status [...args: string] {
    let name = ($args | get -o 0 | default "")
    if $name == "" {
      service_list
      return
    }

    let domain = resolve_service $name
    if (needs_sudo $domain) {
      ^sudo launchctl print $domain
    } else {
      ^launchctl print $domain
    }
  }

  def service_enable [name: string] {
    let domain = resolve_service $name
    print $"Enabling ($name)..."
    if (needs_sudo $domain) {
      ^sudo launchctl enable $domain
    } else {
      ^launchctl enable $domain
    }
    print $"Enabled ($name)"
  }

  def service_disable [name: string] {
    let domain = resolve_service $name
    print $"Disabling ($name)..."
    if (needs_sudo $domain) {
      ^sudo launchctl disable $domain
    } else {
      ^launchctl disable $domain
    }
    print $"Disabled ($name)"
  }

  def service_logs [name: string] {
    let domain = resolve_service $name
    let label = $domain | str replace -r '^[^/]+/' ""
    print $"Showing logs for ($label)..."
    ^log show --predicate $"subsystem == \"($label)\" OR senderImagePath CONTAINS \"($label)\"" --last 1h --style compact
  }

  def service_delete [name: string] {
    let domain = resolve_service $name
    let label = $domain | str replace -r '^[^/]+/' ""

    print $"Removing service ($name)..."

    if (needs_sudo $domain) {
      do { ^sudo launchctl kill SIGTERM $domain } | complete
      do { ^sudo launchctl bootout $domain } | complete
      let plist = $"/Library/LaunchDaemons/($label).plist"
      if ($plist | path exists) {
        print $"Removing ($plist)..."
        ^sudo rm -f $plist
      }
    } else {
      do { ^launchctl kill SIGTERM $domain } | complete
      do { ^launchctl bootout $domain } | complete
      let plist = $"($env.HOME)/Library/LaunchAgents/($label).plist"
      if ($plist | path exists) {
        print $"Removing ($plist)..."
        rm -f $plist
      }
    }

    print $"Removed ($name)"
  }

  def service_usage [] {
    print "Usage: universe service <command> [options]"
    print ""
    print "Commands:"
    print "  list [OPTIONS]     List services"
    print "  start <name>       Start a service"
    print "  stop <name>        Stop a service"
    print "  restart <name>     Restart a service"
    print "  status [name]      Show service status"
    print "  enable <name>      Enable service at boot"
    print "  disable <name>     Disable service at boot"
    print "  delete <name>      Remove zombie/orphaned service"
    print "  logs <name>        View service logs"
    print ""
    print "List options:"
    print "  --all              Show all services (system + third-party + nix)"
    print "  --running          Show only running services"
    print "  --stopped          Show only stopped services"
    print "  --system           Show system daemons only"
    print "  --user             Show user agents only"
  }

  def cmd_service_dispatch [...args: string] {
    let first = ($args | get -o 0 | default "")
    let rest = ($args | skip 1)
    match $first {
      "list" => { service_list ...$rest }
      "start" => {
        if ($rest | length) < 1 { print "Error: start requires a service name"; exit 1 }
        service_start ($rest | first)
      }
      "stop" => {
        if ($rest | length) < 1 { print "Error: stop requires a service name"; exit 1 }
        service_stop ($rest | first)
      }
      "restart" => {
        if ($rest | length) < 1 { print "Error: restart requires a service name"; exit 1 }
        service_restart ($rest | first)
      }
      "status" => { service_status ...$rest }
      "enable" => {
        if ($rest | length) < 1 { print "Error: enable requires a service name"; exit 1 }
        service_enable ($rest | first)
      }
      "disable" => {
        if ($rest | length) < 1 { print "Error: disable requires a service name"; exit 1 }
        service_disable ($rest | first)
      }
      "delete" => {
        if ($rest | length) < 1 { print "Error: delete requires a service name"; exit 1 }
        service_delete ($rest | first)
      }
      "logs" => {
        if ($rest | length) < 1 { print "Error: logs requires a service name"; exit 1 }
        service_logs ($rest | first)
      }
      "--help" | "-h" | "" => { service_usage }
      _ => {
        print $"Unknown service command: ($first)"
        service_usage
        exit 1
      }
    }
  }
''
