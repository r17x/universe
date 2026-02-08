# Linux systemctl service management
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
    echo "  --all              Show all services"
    echo "  --running          Show only running services"
    echo "  --stopped          Show only stopped services"
    echo "  --system           Show system services only"
    echo "  --user             Show user services only"
  }

  parse_systemctl_line() {
    local line="$1"
    local show_all="$2"
    local scope="$3"

    # Parse systemctl output: UNIT LOAD ACTIVE SUB DESCRIPTION
    local unit load active sub
    read -r unit load active sub _ <<< "$line"

    # Skip if not a service
    [[ "$unit" != *.service ]] && return

    # Filter nix services unless --all
    if [[ "$show_all" != "true" ]]; then
      [[ "$unit" != *nixos* ]] && [[ "$unit" != nix-* ]] && return
    fi

    local name="''${unit%.service}"
    local category="other"
    [[ "$unit" == *nixos* ]] || [[ "$unit" == nix-* ]] && category="nix"

    local state="stopped"
    local indicator="○"
    local state_color="$DIM"
    local pid="-"

    if [[ "$active" == "active" ]]; then
      state="running"
      indicator="●"
      state_color="$GREEN"
      # Get PID
      pid=$(systemctl show -p MainPID "$unit" 2>/dev/null | cut -d= -f2)
      [[ "$pid" == "0" ]] && pid="-"
    fi

    local scope_color="$CYAN"
    [[ "$scope" == "user" ]] && scope_color="$YELLOW"

    local type_color="$NC"
    [[ "$category" == "nix" ]] && type_color="$GREEN"

    printf "  %b%s%b %-20s %b%-6s%b %b%-5s%b %6s  %b%s%b\n" \
      "$state_color" "$indicator" "$NC" \
      "$name" \
      "$scope_color" "$scope" "$NC" \
      "$type_color" "$category" "$NC" \
      "$pid" \
      "$state_color" "$state" "$NC"
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
        *) echo "Unknown option: $1"; exit 1 ;;
      esac
    done

    # Header
    printf "  %b%-22s %-6s %-5s %6s  %s%b\n" "$BOLD" "NAME" "SCOPE" "TYPE" "PID" "STATE" "$NC"
    printf "  %b%-22s %-6s %-5s %6s  %s%b\n" "$DIM" "----" "-----" "----" "---" "-----" "$NC"

    local all_lines=()

    if [[ "$show_system" == "true" ]]; then
      local state_filter=""
      [[ "$filter_running" == "true" ]] && state_filter="--state=active"
      [[ "$filter_stopped" == "true" ]] && state_filter="--state=inactive"

      while IFS= read -r line; do
        local parsed
        parsed=$(parse_systemctl_line "$line" "$show_all" "system")
        [[ -n "$parsed" ]] && all_lines+=("$parsed")
      done < <(systemctl list-units --type=service --no-pager --no-legend $state_filter 2>/dev/null)
    fi

    if [[ "$show_user" == "true" ]]; then
      local state_filter=""
      [[ "$filter_running" == "true" ]] && state_filter="--state=active"
      [[ "$filter_stopped" == "true" ]] && state_filter="--state=inactive"

      while IFS= read -r line; do
        local parsed
        parsed=$(parse_systemctl_line "$line" "$show_all" "user")
        [[ -n "$parsed" ]] && all_lines+=("$parsed")
      done < <(systemctl --user list-units --type=service --no-pager --no-legend $state_filter 2>/dev/null)
    fi

    printf '%s\n' "''${all_lines[@]}"
  }

  service_start() {
    local name="$1"
    echo "Starting $name..."

    # Try system first, then user
    if systemctl list-unit-files "$name.service" &>/dev/null; then
      sudo systemctl start "$name"
    else
      systemctl --user start "$name"
    fi

    sleep 0.2
    local state pid
    state=$(systemctl is-active "$name" 2>/dev/null || systemctl --user is-active "$name" 2>/dev/null)
    pid=$(systemctl show -p MainPID "$name" 2>/dev/null | cut -d= -f2)
    [[ -z "$pid" ]] && pid=$(systemctl --user show -p MainPID "$name" 2>/dev/null | cut -d= -f2)

    if [[ "$state" == "active" ]]; then
      printf "%b✓%b %s running (PID %s)\n" "$GREEN" "$NC" "$name" "$pid"
    else
      printf "%b✗%b %s failed to start\n" "$RED" "$NC" "$name"
      return 1
    fi
  }

  service_stop() {
    local name="$1"
    echo "Stopping $name..."

    if systemctl list-unit-files "$name.service" &>/dev/null; then
      sudo systemctl stop "$name"
    else
      systemctl --user stop "$name"
    fi

    sleep 0.2
    local state
    state=$(systemctl is-active "$name" 2>/dev/null || systemctl --user is-active "$name" 2>/dev/null)

    if [[ "$state" != "active" ]]; then
      printf "%b✓%b %s stopped\n" "$GREEN" "$NC" "$name"
    else
      printf "%b✗%b %s still running\n" "$RED" "$NC" "$name"
      return 1
    fi
  }

  service_restart() {
    local name="$1"
    echo "Restarting $name..."

    if systemctl list-unit-files "$name.service" &>/dev/null; then
      sudo systemctl restart "$name"
    else
      systemctl --user restart "$name"
    fi

    sleep 0.2
    local state pid
    state=$(systemctl is-active "$name" 2>/dev/null || systemctl --user is-active "$name" 2>/dev/null)
    pid=$(systemctl show -p MainPID "$name" 2>/dev/null | cut -d= -f2)
    [[ -z "$pid" ]] && pid=$(systemctl --user show -p MainPID "$name" 2>/dev/null | cut -d= -f2)

    if [[ "$state" == "active" ]]; then
      printf "%b✓%b %s running (PID %s)\n" "$GREEN" "$NC" "$name" "$pid"
    else
      printf "%b✗%b %s failed to restart\n" "$RED" "$NC" "$name"
      return 1
    fi
  }

  service_status() {
    if [[ -z "''${1:-}" ]]; then
      service_list
    else
      systemctl status "$1" 2>/dev/null || systemctl --user status "$1"
    fi
  }

  service_enable() {
    local name="$1"
    echo "Enabling $name..."
    if systemctl list-unit-files "$name.service" &>/dev/null; then
      sudo systemctl enable "$name"
    else
      systemctl --user enable "$name"
    fi
    printf "%b✓%b %s enabled\n" "$GREEN" "$NC" "$name"
  }

  service_disable() {
    local name="$1"
    echo "Disabling $name..."
    if systemctl list-unit-files "$name.service" &>/dev/null; then
      sudo systemctl disable "$name"
    else
      systemctl --user disable "$name"
    fi
    printf "%b✓%b %s disabled\n" "$GREEN" "$NC" "$name"
  }

  service_logs() {
    local name="$1"
    journalctl -u "$name" -f 2>/dev/null || journalctl --user -u "$name" -f
  }

  service_delete() {
    local name="$1"
    echo "Removing service $name..."

    # Stop and disable first
    sudo systemctl stop "$name" 2>/dev/null || systemctl --user stop "$name" 2>/dev/null || true
    sudo systemctl disable "$name" 2>/dev/null || systemctl --user disable "$name" 2>/dev/null || true

    # Remove unit files
    local unit_file="/etc/systemd/system/$name.service"
    local user_unit_file="$HOME/.config/systemd/user/$name.service"

    if [[ -f "$unit_file" ]]; then
      sudo rm -f "$unit_file"
      echo "Removed $unit_file"
    fi

    if [[ -f "$user_unit_file" ]]; then
      rm -f "$user_unit_file"
      echo "Removed $user_unit_file"
    fi

    sudo systemctl daemon-reload
    systemctl --user daemon-reload 2>/dev/null || true

    printf "%b✓%b %s removed\n" "$GREEN" "$NC" "$name"
  }

  cmd_service() {
    case "''${1:-}" in
      list) shift; service_list "$@" ;;
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
      status) shift; service_status "$@" ;;
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
      --help|-h|"") service_usage ;;
      *) echo "Unknown command: $1"; service_usage; exit 1 ;;
    esac
  }
''
