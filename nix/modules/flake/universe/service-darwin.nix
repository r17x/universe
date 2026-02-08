# macOS launchctl service management
''
  # Colors
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  CYAN='\033[0;36m'
  DIM='\033[2m'
  BOLD='\033[1m'
  NC='\033[0m' # No Color

  service_usage() {
    echo "Usage: universe service <command> [options]"
    echo ""
    echo "Commands:"
    echo "  list [OPTIONS]     List services"
    echo "  start <name>       Start a service"
    echo "  stop <name>        Stop a service"
    echo "  restart <name>     Restart a service"
    echo "  status [name]      Show service status"
    echo "  enable <name>      Enable service at boot"
    echo "  disable <name>     Disable service at boot"
    echo "  delete <name>      Remove zombie/orphaned service"
    echo "  logs <name>        View service logs"
    echo ""
    echo "List options:"
    echo "  --all              Show all services (system + third-party + nix)"
    echo "  --running          Show only running services"
    echo "  --stopped          Show only stopped services"
    echo "  --system           Show system daemons only"
    echo "  --user             Show user agents only"
    echo ""
    echo "Examples:"
    echo "  universe service list"
    echo "  universe service start linux-builder"
    echo "  universe service stop sketchybar"
    echo "  universe service status"
  }

  resolve_service() {
    local name="$1"
    local label

    if [[ "$name" == *.* ]]; then
      label="$name"
    else
      label="org.nixos.$name"
    fi

    if launchctl print "system/$label" &>/dev/null 2>&1; then
      echo "system/$label"
      return 0
    fi

    if launchctl print "gui/$(id -u)/$label" &>/dev/null 2>&1; then
      echo "gui/$(id -u)/$label"
      return 0
    fi

    if [[ "$name" == *.* ]] && launchctl print "system/$name" &>/dev/null 2>&1; then
      echo "system/$name"
      return 0
    fi

    if [[ "$name" == *.* ]] && launchctl print "gui/$(id -u)/$name" &>/dev/null 2>&1; then
      echo "gui/$(id -u)/$name"
      return 0
    fi

    echo "Error: Service '$name' not found" >&2
    return 1
  }

  needs_sudo() {
    local domain="$1"
    [[ "$domain" == system/* ]]
  }

  parse_service_line() {
    local line="$1"
    local show_all="$2"
    local scope="$3"
    local pid status label

    if [[ "$line" =~ ^[[:space:]]*([0-9-]+)[[:space:]]+([0-9(pe)-]+)[[:space:]]+(.+)$ ]]; then
      pid="''${BASH_REMATCH[1]}"
      status="''${BASH_REMATCH[2]}"
      label="''${BASH_REMATCH[3]}"

      if [[ "$show_all" != "true" ]] && [[ "$label" != org.nixos.* ]]; then
        return
      fi

      local category="other"
      if [[ "$label" == org.nixos.* ]]; then
        category="nix"
      elif [[ "$label" == com.apple.* ]]; then
        category="apple"
      fi

      local state="stopped"
      local indicator="○"
      local state_color="$DIM"
      if [[ "$pid" != "0" ]] && [[ "$pid" != "-" ]]; then
        state="running"
        indicator="●"
        state_color="$GREEN"
      fi

      local display_name="$label"
      if [[ "$label" == org.nixos.* ]]; then
        display_name="''${label#org.nixos.}"
      fi

      local scope_color="$CYAN"
      [[ "$scope" == "user" ]] && scope_color="$YELLOW"

      local type_color="$NC"
      [[ "$category" == "nix" ]] && type_color="$GREEN"
      [[ "$category" == "apple" ]] && type_color="$DIM"

      printf "  %b%s%b %-20s %b%-6s%b %b%-5s%b %6s  %b%s%b\n" \
        "$state_color" "$indicator" "$NC" \
        "$display_name" \
        "$scope_color" "$scope" "$NC" \
        "$type_color" "$category" "$NC" \
        "$pid" \
        "$state_color" "$state" "$NC"
    fi
  }

  service_list() {
    local show_all="false"
    local filter_running=""
    local filter_stopped=""
    local show_system="true"
    local show_user="true"

    while [[ $# -gt 0 ]]; do
      case "$1" in
        --all) show_all="true"; shift ;;
        --running) filter_running="true"; shift ;;
        --stopped) filter_stopped="true"; shift ;;
        --system) show_user="false"; shift ;;
        --user) show_system="false"; shift ;;
        *) echo "Unknown option: $1"; service_usage; exit 1 ;;
      esac
    done

    # Header
    printf "  %b%-22s %-6s %-5s %6s  %s%b\n" "$BOLD" "NAME" "SCOPE" "TYPE" "PID" "STATE" "$NC"
    printf "  %b%-22s %-6s %-5s %6s  %s%b\n" "$DIM" "----" "-----" "----" "---" "-----" "$NC"

    # Collect all services
    local all_lines=()

    if [[ "$show_system" == "true" ]]; then
      local system_output
      system_output=$(launchctl print system 2>/dev/null | grep -E '^\s+[0-9-]+\s+' | grep -v "subdomains")

      while IFS= read -r line; do
        local parsed
        parsed=$(parse_service_line "$line" "$show_all" "system")
        if [[ -n "$parsed" ]]; then
          if [[ "$filter_running" == "true" ]] && [[ "$parsed" != *"running"* ]]; then
            continue
          fi
          if [[ "$filter_stopped" == "true" ]] && [[ "$parsed" != *"stopped"* ]]; then
            continue
          fi
          all_lines+=("$parsed")
        fi
      done <<< "$system_output"
    fi

    if [[ "$show_user" == "true" ]]; then
      local user_output
      user_output=$(launchctl print "gui/$(id -u)" 2>/dev/null | grep -E '^\s+[0-9-]+\s+' | grep -v "subdomains")

      while IFS= read -r line; do
        local parsed
        parsed=$(parse_service_line "$line" "$show_all" "user")
        if [[ -n "$parsed" ]]; then
          if [[ "$filter_running" == "true" ]] && [[ "$parsed" != *"running"* ]]; then
            continue
          fi
          if [[ "$filter_stopped" == "true" ]] && [[ "$parsed" != *"stopped"* ]]; then
            continue
          fi
          all_lines+=("$parsed")
        fi
      done <<< "$user_output"
    fi

    # Print all
    printf '%s\n' "''${all_lines[@]}"
  }

  get_plist_path() {
    local domain="$1"
    launchctl print "$domain" 2>/dev/null | grep "path = " | sed 's/.*path = //'
  }

  service_start() {
    local name="$1"
    local domain
    domain=$(resolve_service "$name") || exit 1
    local label="''${domain#*/}"

    echo "Starting $name..."
    if needs_sudo "$domain"; then
      local plist="/Library/LaunchDaemons/$label.plist"
      sudo launchctl bootstrap system "$plist" 2>/dev/null || sudo launchctl kickstart "$domain"
    else
      local plist="$HOME/Library/LaunchAgents/$label.plist"
      launchctl bootstrap "gui/$(id -u)" "$plist" 2>/dev/null || launchctl kickstart "$domain"
    fi

    sleep 0.2
    local pid state
    pid=$(launchctl print "$domain" 2>/dev/null | grep "pid = " | awk '{print $3}')
    state=$(launchctl print "$domain" 2>/dev/null | grep "state = " | awk '{print $3}')

    if [[ "$state" == "running" ]] && [[ -n "$pid" ]]; then
      printf "%b✓%b %s running (PID %s)\n" "$GREEN" "$NC" "$name" "$pid"
    else
      printf "%b✗%b %s failed to start (state: %s)\n" "$RED" "$NC" "$name" "$state"
      return 1
    fi
  }

  service_stop() {
    local name="$1"
    local domain
    domain=$(resolve_service "$name") || exit 1

    echo "Stopping $name..."
    if needs_sudo "$domain"; then
      sudo launchctl kill SIGTERM "$domain"
    else
      launchctl kill SIGTERM "$domain"
    fi

    sleep 0.2
    local state
    state=$(launchctl print "$domain" 2>/dev/null | grep "state = " | awk '{print $3}')

    if [[ "$state" != "running" ]]; then
      printf "%b✓%b %s stopped\n" "$GREEN" "$NC" "$name"
    else
      printf "%b✗%b %s still running\n" "$RED" "$NC" "$name"
      return 1
    fi
  }

  service_restart() {
    local name="$1"
    local domain label plist

    # Get info before stopping
    domain=$(resolve_service "$name") || exit 1
    label="''${domain#*/}"

    if needs_sudo "$domain"; then
      plist="/Library/LaunchDaemons/$label.plist"
    else
      plist="$HOME/Library/LaunchAgents/$label.plist"
    fi

    echo "Restarting $name..."

    # Kill process but keep service loaded
    if needs_sudo "$domain"; then
      sudo launchctl kill SIGTERM "$domain" 2>/dev/null || true
      sleep 0.3
      sudo launchctl kickstart "$domain" 2>/dev/null || sudo launchctl bootstrap system "$plist"
    else
      launchctl kill SIGTERM "$domain" 2>/dev/null || true
      sleep 0.3
      launchctl kickstart "$domain" 2>/dev/null || launchctl bootstrap "gui/$(id -u)" "$plist"
    fi

    # Verify
    sleep 0.2
    local pid state
    pid=$(launchctl print "$domain" 2>/dev/null | grep "pid = " | awk '{print $3}')
    state=$(launchctl print "$domain" 2>/dev/null | grep "state = " | awk '{print $3}')

    if [[ "$state" == "running" ]] && [[ -n "$pid" ]]; then
      printf "%b✓%b %s running (PID %s)\n" "$GREEN" "$NC" "$name" "$pid"
    else
      printf "%b✗%b %s failed to restart (state: %s)\n" "$RED" "$NC" "$name" "$state"
      return 1
    fi
  }

  service_status() {
    local name="''${1:-}"

    if [[ -z "$name" ]]; then
      service_list
      return
    fi

    local domain
    domain=$(resolve_service "$name") || exit 1

    if needs_sudo "$domain"; then
      sudo launchctl print "$domain"
    else
      launchctl print "$domain"
    fi
  }

  service_enable() {
    local name="$1"
    local domain
    domain=$(resolve_service "$name") || exit 1

    echo "Enabling $name..."
    if needs_sudo "$domain"; then
      sudo launchctl enable "$domain"
    else
      launchctl enable "$domain"
    fi
    echo "Enabled $name"
  }

  service_disable() {
    local name="$1"
    local domain
    domain=$(resolve_service "$name") || exit 1

    echo "Disabling $name..."
    if needs_sudo "$domain"; then
      sudo launchctl disable "$domain"
    else
      launchctl disable "$domain"
    fi
    echo "Disabled $name"
  }

  service_logs() {
    local name="$1"
    local domain
    domain=$(resolve_service "$name") || exit 1

    local label="''${domain#*/}"

    echo "Showing logs for $label..."
    log show --predicate "subsystem == \"$label\" OR senderImagePath CONTAINS \"$label\"" --last 1h --style compact
  }

  service_delete() {
    local name="$1"
    local domain
    domain=$(resolve_service "$name") || exit 1

    local label="''${domain#*/}"
    local domain_type="''${domain%%/*}"

    echo "Removing service $name..."

    if needs_sudo "$domain"; then
      sudo launchctl kill SIGTERM "$domain" 2>/dev/null || true
      sudo launchctl bootout "$domain" 2>/dev/null || true
      local plist="/Library/LaunchDaemons/$label.plist"
      if [[ -f "$plist" ]]; then
        echo "Removing $plist..."
        sudo rm -f "$plist"
      fi
    else
      launchctl kill SIGTERM "$domain" 2>/dev/null || true
      launchctl bootout "$domain" 2>/dev/null || true
      local plist="$HOME/Library/LaunchAgents/$label.plist"
      if [[ -f "$plist" ]]; then
        echo "Removing $plist..."
        rm -f "$plist"
      fi
    fi

    echo "Removed $name"
  }

  cmd_service() {
    case "''${1:-}" in
      list)
        shift
        service_list "$@"
        ;;
      start)
        shift
        if [[ $# -lt 1 ]]; then
          echo "Error: start requires a service name"
          exit 1
        fi
        service_start "$1"
        ;;
      stop)
        shift
        if [[ $# -lt 1 ]]; then
          echo "Error: stop requires a service name"
          exit 1
        fi
        service_stop "$1"
        ;;
      restart)
        shift
        if [[ $# -lt 1 ]]; then
          echo "Error: restart requires a service name"
          exit 1
        fi
        service_restart "$1"
        ;;
      status)
        shift
        service_status "$@"
        ;;
      enable)
        shift
        if [[ $# -lt 1 ]]; then
          echo "Error: enable requires a service name"
          exit 1
        fi
        service_enable "$1"
        ;;
      disable)
        shift
        if [[ $# -lt 1 ]]; then
          echo "Error: disable requires a service name"
          exit 1
        fi
        service_disable "$1"
        ;;
      delete)
        shift
        if [[ $# -lt 1 ]]; then
          echo "Error: delete requires a service name"
          exit 1
        fi
        service_delete "$1"
        ;;
      logs)
        shift
        if [[ $# -lt 1 ]]; then
          echo "Error: logs requires a service name"
          exit 1
        fi
        service_logs "$1"
        ;;
      --help|-h|"")
        service_usage
        ;;
      *)
        echo "Unknown service command: $1"
        service_usage
        exit 1
        ;;
    esac
  }
''
