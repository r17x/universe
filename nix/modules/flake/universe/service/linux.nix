''
  def parse_systemctl_line [line: string, show_all: bool, scope: string] {
    let parts = ($line | str trim | split row -r '\s+')
    if ($parts | length) < 4 {
      return {}
    }
    let unit = $parts.0
    let active = $parts.2

    if not ($unit | str ends-with ".service") {
      return {}
    }

    if not $show_all and not ($unit =~ 'nixos|nix-') {
      return {}
    }

    let name = $unit | str replace ".service" ""
    let category = if ($unit =~ 'nixos|nix-') { "nix" } else { "other" }

    let is_running = $active == "active"
    let state = if $is_running { "running" } else { "stopped" }
    let indicator = if $is_running { "●" } else { "○" }
    let state_color = if $is_running { (ansi green) } else { (ansi default_dimmed) }

    let pid = if $is_running {
      let pid_result = (do { ^systemctl show -p MainPID $unit } | complete)
      let p = ($pid_result.stdout | str trim | split row "=" | last)
      if $p == "0" { "-" } else { $p }
    } else {
      "-"
    }

    let scope_color = if $scope == "user" { (ansi yellow) } else { (ansi cyan) }
    let type_color = if $category == "nix" { (ansi green) } else { (ansi reset) }

    {
      line: $"  ($state_color)($indicator)(ansi reset) ($name | fill -w 20) ($scope_color)($scope | fill -w 6)(ansi reset) ($type_color)($category | fill -w 5)(ansi reset) ($pid | fill -a right -w 6)  ($state_color)($state)(ansi reset)"
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

    mut state_filter = []
    if $filter_running { $state_filter = ($state_filter | append "--state=active") }
    if $filter_stopped { $state_filter = ($state_filter | append "--state=inactive") }
    let state_filter = $state_filter

    if $show_system {
      let result = (do { ^systemctl list-units --type=service --no-pager --no-legend ...$state_filter } | complete)
      if $result.exit_code == 0 {
        for line in ($result.stdout | lines) {
          let parsed = parse_systemctl_line $line $show_all "system"
          if ($parsed | columns | length) > 0 and ($parsed | get -o line | default "") != "" {
            print $parsed.line
          }
        }
      }
    }

    if $show_user {
      let result = (do { ^systemctl --user list-units --type=service --no-pager --no-legend ...$state_filter } | complete)
      if $result.exit_code == 0 {
        for line in ($result.stdout | lines) {
          let parsed = parse_systemctl_line $line $show_all "user"
          if ($parsed | columns | length) > 0 and ($parsed | get -o line | default "") != "" {
            print $parsed.line
          }
        }
      }
    }
  }

  def service_start [name: string] {
    print $"Starting ($name)..."
    let sys_result = (do { ^systemctl list-unit-files $"($name).service" } | complete)
    if $sys_result.exit_code == 0 {
      ^sudo systemctl start $name
    } else {
      ^systemctl --user start $name
    }

    sleep 200ms
    let state = (do { ^systemctl is-active $name } | complete).stdout | str trim
    let state = if $state != "active" { (do { ^systemctl --user is-active $name } | complete).stdout | str trim } else { $state }
    let pid_result = (do { ^systemctl show -p MainPID $name } | complete)
    let pid = if $pid_result.exit_code == 0 { $pid_result.stdout | str trim | split row "=" | last } else {
      let pid_result2 = (do { ^systemctl --user show -p MainPID $name } | complete)
      $pid_result2.stdout | str trim | split row "=" | last
    }

    if $state == "active" {
      print $"(ansi green)✓(ansi reset) ($name) running \(PID ($pid)\)"
    } else {
      print $"(ansi red)✗(ansi reset) ($name) failed to start"
      exit 1
    }
  }

  def service_stop [name: string] {
    print $"Stopping ($name)..."
    let sys_result = (do { ^systemctl list-unit-files $"($name).service" } | complete)
    if $sys_result.exit_code == 0 {
      ^sudo systemctl stop $name
    } else {
      ^systemctl --user stop $name
    }

    sleep 200ms
    let state = (do { ^systemctl is-active $name } | complete).stdout | str trim
    let state = if $state == "active" { (do { ^systemctl --user is-active $name } | complete).stdout | str trim } else { $state }

    if $state != "active" {
      print $"(ansi green)✓(ansi reset) ($name) stopped"
    } else {
      print $"(ansi red)✗(ansi reset) ($name) still running"
      exit 1
    }
  }

  def service_restart [name: string] {
    print $"Restarting ($name)..."
    let sys_result = (do { ^systemctl list-unit-files $"($name).service" } | complete)
    if $sys_result.exit_code == 0 {
      ^sudo systemctl restart $name
    } else {
      ^systemctl --user restart $name
    }

    sleep 200ms
    let state = (do { ^systemctl is-active $name } | complete).stdout | str trim
    let state = if $state != "active" { (do { ^systemctl --user is-active $name } | complete).stdout | str trim } else { $state }
    let pid_result = (do { ^systemctl show -p MainPID $name } | complete)
    let pid = if $pid_result.exit_code == 0 { $pid_result.stdout | str trim | split row "=" | last } else {
      let pid_result2 = (do { ^systemctl --user show -p MainPID $name } | complete)
      $pid_result2.stdout | str trim | split row "=" | last
    }

    if $state == "active" {
      print $"(ansi green)✓(ansi reset) ($name) running \(PID ($pid)\)"
    } else {
      print $"(ansi red)✗(ansi reset) ($name) failed to restart"
      exit 1
    }
  }

  def service_status [...args: string] {
    let name = ($args | get -o 0 | default "")
    if $name == "" {
      service_list
      return
    }
    let result = (do { ^systemctl status $name } | complete)
    if $result.exit_code != 0 {
      ^systemctl --user status $name
    } else {
      print $result.stdout
    }
  }

  def service_enable [name: string] {
    print $"Enabling ($name)..."
    let sys_result = (do { ^systemctl list-unit-files $"($name).service" } | complete)
    if $sys_result.exit_code == 0 {
      ^sudo systemctl enable $name
    } else {
      ^systemctl --user enable $name
    }
    print $"(ansi green)✓(ansi reset) ($name) enabled"
  }

  def service_disable [name: string] {
    print $"Disabling ($name)..."
    let sys_result = (do { ^systemctl list-unit-files $"($name).service" } | complete)
    if $sys_result.exit_code == 0 {
      ^sudo systemctl disable $name
    } else {
      ^systemctl --user disable $name
    }
    print $"(ansi green)✓(ansi reset) ($name) disabled"
  }

  def service_logs [name: string] {
    let result = (do { ^journalctl -u $name --no-pager -n 100 } | complete)
    if $result.exit_code != 0 {
      ^journalctl --user -u $name --no-pager -n 100
    } else {
      print $result.stdout
    }
  }

  def service_delete [name: string] {
    print $"Removing service ($name)..."
    do { ^sudo systemctl stop $name } | complete
    do { ^systemctl --user stop $name } | complete
    do { ^sudo systemctl disable $name } | complete
    do { ^systemctl --user disable $name } | complete

    let unit_file = $"/etc/systemd/system/($name).service"
    let user_unit_file = $"($env.HOME)/.config/systemd/user/($name).service"

    if ($unit_file | path exists) {
      ^sudo rm -f $unit_file
      print $"Removed ($unit_file)"
    }

    if ($user_unit_file | path exists) {
      rm -f $user_unit_file
      print $"Removed ($user_unit_file)"
    }

    ^sudo systemctl daemon-reload
    do { ^systemctl --user daemon-reload } | complete

    print $"(ansi green)✓(ansi reset) ($name) removed"
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
    print "  --all              Show all services"
    print "  --running          Show only running services"
    print "  --stopped          Show only stopped services"
    print "  --system           Show system services only"
    print "  --user             Show user services only"
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
