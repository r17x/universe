const GREEN = "\e[32m"
const RED = "\e[31m"
const YELLOW = "\e[33m"
const DIM = "\e[2m"
const BOLD = "\e[1m"
const RESET = "\e[0m"

def pass [label: string] { print $"  ($GREEN)✓($RESET) ($label)" }
def fail [label: string, detail: string = ""] {
  print $"  ($RED)✗ ($label)($RESET) ($detail)"
  exit 1
}
def section [label: string] { print $"\n($BOLD)($label)($RESET)" }
def header [label: string] {
  print $"($BOLD)($label)($RESET)"
  print $"($DIM)(1..($label | str length) | each { '═' } | str join)($RESET)"
}
def waiting [msg: string = "press BOOTSEL when LED blinks"] { print -n $"  ($YELLOW)◆ ($msg)($RESET)" }
def clear-waiting [label: string] { print -n $"\r\e[2K"; pass $label }

def fido-expect [args: string, pin: string] {
  let script = $"
set timeout 20
spawn ($args)
expect {
  -re {Enter PIN.*:} { send \"($pin)\\r\"; exp_continue }
  timeout { exit 2 }
  eof {}
}
lassign [wait] pid spawnid os_error exit_code
exit $exit_code
"
  ^expect -c $script | complete
}

def fido-expect-stdin [args: string, stdin_lines: list<string>, pin: string] {
  let sends = ($stdin_lines | each { |l| $"send \"($l)\\n\"" } | str join "\n")
  let script = $"
set timeout 20
spawn ($args)
($sends)
expect {
  -re {Enter PIN.*:} { send \"($pin)\\r\"; exp_continue }
  timeout { exit 2 }
  eof {}
}
lassign [wait] pid spawnid os_error exit_code
exit $exit_code
"
  ^expect -c $script | complete
}

def detect-device [] {
  let lines = (^fido2-token -L | lines | where { |l| $l | str contains "r17c" })
  if ($lines | is-empty) {
    print $"($RED)no r17c device found($RESET)"
    exit 1
  }
  let parts = ($lines | first | split row ":")
  $"($parts | get 0):($parts | get 1)" | str trim
}

# Security key CLI for Raspberry Pi Pico (FIDO2 + OpenPGP + OATH)
def main []: nothing -> nothing {
  print "Usage: r17c <command>"
  print ""
  print "Commands:"
  print "  verify       Run 10-check device verification suite"
  print "  status       Device status (FIDO2 + OpenPGP + OATH)"
  print "  pin set      Set passkey PIN"
  print "  pin change   Change passkey PIN"
  print "  credentials  List stored passkeys"
  print "  reset        Factory reset (within 10s of boot)"
  print "  flash        Build + flash firmware"
  print "  info         Raw device queries"
  print "  pgp          OpenPGP card operations"
  print "  oath         OATH credential management"
}

# Run 10-check device verification suite [--pin <p>] [--device <d>] [--skip-oath]
def "main verify" [
  --pin: string
  --device: string
  --skip-oath
]: nothing -> nothing {
  header "r17c device verification"

  mut passed = 0
  let total = if $skip_oath { 9 } else { 10 }

  # ── device ──
  section "device"

  let dev = if ($device | is-not-empty) { $device } else { detect-device }
  pass $"($dev)"
  $passed += 1

  let p = if ($pin | is-not-empty) { $pin } else {
    input $"($YELLOW)  ● PIN: ($RESET)"
  }

  let info = (^fido2-token -I $dev)
  if ("FIDO_2_0" in $info) and ("U2F_V2" in $info) and ("es256" in $info) and ("clientPin" in $info) {
    pass "FIDO_2_0, U2F_V2, es256, clientPin"
  } else {
    fail "GetInfo" $info
  }
  $passed += 1

  let pin_set_script = $"
set timeout 10
spawn fido2-token -S ($dev)
expect {
  -re {Enter new PIN.*:} { send \"($p)\\r\"; exp_continue }
  -re {Enter the same PIN.*:} { send \"($p)\\r\"; exp_continue }
  timeout { exit 2 }
  eof {}
}
lassign [wait] pid spawnid os_error exit_code
exit $exit_code
"
  let pin_set_result = (^expect -c $pin_set_script | complete)
  if $pin_set_result.exit_code == 0 and ("NOT_ALLOWED" not-in ($pin_set_result.stderr | default "")) {
    print $"  ($DIM)  PIN was not set, configured now($RESET)"
  }

  let info = (^fido2-token -I $dev)
  let retries = ($info | lines | where { |l| "pin retries" in $l } | first | split column ":" | get column2 | first | str trim)
  print $"  ($DIM)  pin retries: ($retries)($RESET)"

  let rp = "r17c-verify.test"

  # ── fido2 ──
  section "fido2"

  let cdh = (^openssl rand -base64 32 | str trim)
  let uid = (^openssl rand -hex 16 | str trim)
  waiting
  let result = (fido-expect-stdin $"fido2-cred -M -i /dev/stdin -o /tmp/r17c-verify-cred.txt ($dev)" [$cdh $rp "verify-user" $uid] $p)
  if $result.exit_code == 0 {
    clear-waiting "MakeCredential (non-resident)"
  } else {
    fail "MakeCredential (non-resident)" $result.stderr
  }
  $passed += 1

  let verify = (do { ^fido2-cred -V -i /tmp/r17c-verify-cred.txt } | complete)
  if $verify.exit_code == 0 {
    pass "credential verify"
  } else {
    fail "credential verify" $verify.stderr
  }
  $passed += 1

  let cdh_rk = (^openssl rand -base64 32 | str trim)
  let uid_rk = (^openssl rand -hex 16 | str trim)
  waiting
  let rk_result = (fido-expect-stdin $"fido2-cred -M -r -i /dev/stdin -o /tmp/r17c-verify-rk.txt ($dev)" [$cdh_rk $rp "verify-rk" $uid_rk] $p)
  if $rk_result.exit_code == 0 {
    clear-waiting "MakeCredential (resident)"
  } else {
    fail "MakeCredential (resident)" $rk_result.stderr
  }
  $passed += 1

  if ("credMgmt" in $info) and ("credentialMgmtPreview" in $info) {
    pass "credMgmt capability"
  } else {
    fail "credMgmt" "not advertised in GetInfo"
  }
  $passed += 1

  let cdh_assert = (^openssl rand -base64 32 | str trim)
  waiting
  let assert_result = (fido-expect-stdin $"fido2-assert -G -r -v -i /dev/stdin -o /tmp/r17c-verify-assert.txt ($dev)" [$cdh_assert $rp] $p)
  if $assert_result.exit_code == 0 {
    clear-waiting "GetAssertion (resident, PIN + UV)"
  } else {
    fail "GetAssertion" $"exit=($assert_result.exit_code) out=($assert_result.stdout | default '') err=($assert_result.stderr | default '')"
  }
  $passed += 1

  # ── interfaces ──
  section "interfaces"

  let pcsc = (do { ^pcsc_scan -r } | complete)
  if ("r17c" in $pcsc.stdout) {
    pass "PCSC/CCID reader"
  } else {
    fail "PCSC/CCID" "reader not found"
  }
  $passed += 1

  if not $skip_oath {
    let oath_add = (do { ^ykman -r "r17c" oath accounts add r17c-verify-tmp JBSWY3DPEHPK3PXP --force } | complete)
    if $oath_add.exit_code != 0 { fail "OATH add" $oath_add.stderr }

    let oath_code = (do { ^ykman -r "r17c" oath accounts code r17c-verify-tmp } | complete)
    if $oath_code.exit_code != 0 { fail "OATH code" $oath_code.stderr }
    let code = ($oath_code.stdout | str trim | split row " " | last)

    let oath_del = (do { ^ykman -r "r17c" oath accounts delete r17c-verify-tmp --force } | complete)
    if $oath_del.exit_code != 0 { fail "OATH delete" $oath_del.stderr }

    pass $"OATH add/code/delete \(($code))"
    $passed += 1
  } else {
    print $"  ($DIM)⊘ OATH (skipped)($RESET)"
  }

  # ── recovery ──
  section "recovery"

  let post_info = (do { ^fido2-token -I $dev } | complete)
  if $post_info.exit_code == 0 and ("FIDO_2_0" in $post_info.stdout) {
    pass "GetInfo post-suite (device responsive)"
  } else {
    fail "GetInfo post-suite" "device unresponsive after test sequence"
  }
  $passed += 1

  do { rm /tmp/r17c-verify-cred.txt /tmp/r17c-verify-rk.txt /tmp/r17c-verify-assert.txt } | ignore

  print ""
  if $passed == $total {
    print $"($GREEN)($passed)/($total) passed($RESET)"
  } else {
    print $"($RED)($passed)/($total) passed($RESET)"
  }
}

# Device status (FIDO2 + OpenPGP + OATH)
def "main status" []: nothing -> nothing {
  header "r17c status"

  section "device"
  let dev = detect-device
  pass $"($dev)"

  section "fido2"
  let info = (^fido2-token -I $dev)
  let pin_set = ("clientPin" in $info)
  let retries = ($info | lines | where { |l| "pin retries" in $l } | first | default "" | split column ":" | get column2 | first | default "" | str trim)
  if $pin_set {
    pass $"PIN set \(($retries) retries)"
  } else {
    print $"  ($YELLOW)● PIN not set($RESET)"
  }
  if ("credMgmt" in $info) {
    pass "credMgmt"
  }

  section "openpgp"
  let gpg = (do { ^gpg --card-status } | complete)
  if $gpg.exit_code == 0 {
    let lines = ($gpg.stdout | lines)
    let sig = ($lines | where { |l| "Signature key" in $l } | first | default "")
    let enc = ($lines | where { |l| "Encryption key" in $l } | first | default "")
    let auth = ($lines | where { |l| "Authentication key" in $l } | first | default "")
    if ($sig | is-not-empty) { pass ($sig | str trim) }
    if ($enc | is-not-empty) { pass ($enc | str trim) }
    if ($auth | is-not-empty) { pass ($auth | str trim) }
  } else {
    print $"  ($DIM)scdaemon not configured — add pcsc-driver to scdaemon.conf($RESET)"
  }

  section "oath"
  let oath = (do { ^ykman -r "r17c" oath accounts list } | complete)
  if $oath.exit_code == 0 and ($oath.stdout | str trim | is-not-empty) {
    $oath.stdout | lines | each { |l| pass ($l | str trim) } | ignore
  } else if $oath.exit_code == 0 {
    print $"  ($DIM)no accounts($RESET)"
  } else {
    print $"  ($DIM)not available($RESET)"
  }
}

# Set passkey PIN
def "main pin set" []: nothing -> nothing {
  header "r17c pin set"

  section "device"
  let dev = detect-device
  pass $"($dev)"

  section "pin"
  let result = (do { ^fido2-token -S $dev } | complete)
  if $result.exit_code == 0 {
    pass "PIN set"
  } else if "NOT_ALLOWED" in ($result.stderr | default "") {
    print $"  ($YELLOW)● PIN already set, changing($RESET)"
    ^fido2-token -C $dev
  } else {
    fail "PIN set" ($result.stderr | default $result.stdout)
  }
}

# Change passkey PIN
def "main pin change" []: nothing -> nothing {
  header "r17c pin change"

  section "device"
  let dev = detect-device
  pass $"($dev)"

  section "pin"
  ^fido2-token -C $dev
}

# List stored passkeys [--pin <p>]
def "main credentials" [--pin: string]: nothing -> nothing {
  header "r17c credentials"

  section "device"
  let dev = detect-device
  pass $"($dev)"

  let p = if ($pin | is-not-empty) { $pin } else {
    input $"($YELLOW)  ● PIN: ($RESET)"
  }

  section "credentials"
  let result = (fido-expect $"fido2-token -L -r ($dev)" $p)
  if $result.exit_code == 0 {
    $result.stdout | lines | where { |l| ($l | str trim) != "" } | each { |l| pass ($l | str trim) } | ignore
  } else {
    fail "list credentials"
  }
}

# Factory reset (within 10s of boot)
def "main reset" []: nothing -> nothing {
  header "r17c reset"

  section "device"
  let dev = detect-device
  pass $"($dev)"

  section "reset"
  print $"  ($DIM)erases all FIDO2 credentials, PIN, and counter($RESET)"
  print $"  ($DIM)OpenPGP and OATH storage are not affected($RESET)"
  print $"  ($DIM)device must have been plugged in within the last 10 seconds($RESET)"
  print ""
  let confirm = (input $"($YELLOW)  ● type YES to confirm: ($RESET)")
  if $confirm == "YES" {
    let result = (do { ^fido2-token -R $dev } | complete)
    if $result.exit_code == 0 {
      pass "factory reset complete"
    } else {
      fail "factory reset" $result.stderr
    }
  } else {
    print $"  ($DIM)aborted($RESET)"
  }
}

# Blink LED to identify device
def "main wink" []: nothing -> nothing {
  header "r17c wink"

  section "device"
  let dev = detect-device
  pass $"($dev)"

  section "wink"
  let result = (do { ^fido2-token -w $dev } | complete)
  if $result.exit_code == 0 {
    pass "LED blink sent"
  } else {
    print $"  ($DIM)not supported by this libfido2 version($RESET)"
  }
}

# Build + flash firmware
def "main flash" []: nothing -> nothing {
  header "r17c flash"
  let flake_root = ($env.FLAKE_ROOT? | default (pwd))

  section "build"
  let dev_check = (do { ^fido2-token -L } | complete)
  if ("r17c" in $dev_check.stdout) {
    print $"  ($YELLOW)● r17c is currently connected($RESET)"
    print $"  ($DIM)unplug, then hold BOOTSEL + plug in($RESET)"
  }

  waiting "building firmware..."
  let build = (do { cd $"($flake_root)/apps/r17c"; ^nix develop $"($flake_root)#r17c" -c cargo build --release } | complete)
  if $build.exit_code != 0 {
    fail "cargo build" $build.stderr
  }
  let elf = $"($flake_root)/apps/r17c/target/thumbv6m-none-eabi/release/r17c"
  let uf2 = $"($flake_root)/apps/r17c/target/r17c.uf2"
  let convert = (do { ^picotool uf2 convert $elf -t elf $uf2 --family rp2040 } | complete)
  if $convert.exit_code != 0 {
    fail "UF2 conversion" $convert.stderr
  }
  let size = (ls $uf2 | get 0.size | into string)
  clear-waiting $"built ($size) bytes UF2"

  section "flash"
  waiting "hold BOOTSEL + plug in r17c..."
  let boot_vol = if (sys host | get name) == "Darwin" { "/Volumes/RPI-RP2" } else {
    glob /run/media/*/RPI-RP2 | first | default "/media/RPI-RP2"
  }
  mut attempts = 0
  while not ($boot_vol | path exists) {
    sleep 1sec
    $attempts += 1
    if $attempts > 60 {
      fail "bootloader" "timeout"
    }
  }
  clear-waiting "detected bootloader"

  cp $uf2 $boot_vol
  pass "copied r17c.uf2"

  waiting "waiting for device..."
  sleep 3sec
  mut dev_attempts = 0
  loop {
    let check = (do { ^fido2-token -L } | complete)
    if ("r17c" in $check.stdout) {
      clear-waiting "r17c ready"
      break
    }
    $dev_attempts += 1
    if $dev_attempts > 30 {
      print -n $"\r\e[2K"
      print $"  ($YELLOW)● device not yet detected — check USB connection($RESET)"
      break
    }
    sleep 1sec
  }
}

# Raw device queries
def "main info" []: nothing -> nothing {
  print "Usage: r17c info <subsystem>"
  print ""
  print "Subsystems:"
  print "  passkey    FIDO2 GetInfo (fido2-token -I)"
  print "  pgp        OpenPGP card status (gpg --card-status)"
  print "  oath       OATH applet info (ykman oath info)"
}

# FIDO2 GetInfo
def "main info passkey" []: nothing -> nothing {
  header "r17c info passkey"

  section "device"
  let dev = detect-device
  pass $"($dev)"

  section "getinfo"
  ^fido2-token -I $dev
}

# OpenPGP card status
def "main info pgp" []: nothing -> nothing {
  header "r17c info pgp"

  section "openpgp"
  let result = (do { ^gpg --card-status } | complete)
  if $result.exit_code == 0 {
    pass "card detected"
    print $result.stdout
  } else {
    fail "gpg --card-status" $result.stderr
  }
}

# OATH applet info
def "main info oath" []: nothing -> nothing {
  header "r17c info oath"

  section "oath"
  let result = (do { ^ykman -r "r17c" oath info } | complete)
  if $result.exit_code == 0 {
    pass "applet detected"
    print $result.stdout
  } else {
    fail "ykman oath info" $result.stderr
  }
}

# OpenPGP card operations
def "main pgp" []: nothing -> nothing {
  header "r17c pgp"

  section "openpgp"
  let result = (do { ^gpg --card-status } | complete)
  if $result.exit_code == 0 {
    pass "card detected"
    let lines = ($result.stdout | lines)
    let sig = ($lines | where { |l| "Signature key" in $l } | first | default "")
    let enc = ($lines | where { |l| "Encryption key" in $l } | first | default "")
    let auth = ($lines | where { |l| "Authentication key" in $l } | first | default "")
    if ($sig | is-not-empty) { pass ($sig | str trim) }
    if ($enc | is-not-empty) { pass ($enc | str trim) }
    if ($auth | is-not-empty) { pass ($auth | str trim) }
  } else {
    fail "gpg --card-status" $result.stderr
  }
}

# Generate sign/enc/auth keys on card
def "main pgp keygen" []: nothing -> nothing {
  header "r17c pgp keygen"

  section "openpgp"
  print $"  ($DIM)generates sign/enc/auth P-256 keys on card($RESET)"
  print $"  ($DIM)interactive — follow the prompts($RESET)"
  let script = "
set timeout 60
spawn gpg --card-edit
expect \"gpg/card>\"
send \"admin\\r\"
expect \"gpg/card>\"
send \"generate\\r\"
expect {
  -re {Make off-card backup.*\\?} { send \"n\\r\"; exp_continue }
  -re {existing keys.*Replace.*\\?} { send \"y\\r\"; exp_continue }
  -re {PIN} { interact; return }
  -re {gpg/card>} {}
  timeout { exit 2 }
  eof {}
}
interact
"
  ^expect -c $script
}

# Import existing key to card <keygrip>
def "main pgp import" [keygrip: string]: nothing -> nothing {
  header "r17c pgp import"

  section "openpgp"
  print $"  ($DIM)importing ($keygrip) to card($RESET)"
  let script = $"
set timeout 60
spawn gpg --edit-key ($keygrip)
expect \"gpg>\"
send \"keytocard\\r\"
interact
"
  ^expect -c $script
}

# Set OpenPGP user PIN
def "main pgp pin set" []: nothing -> nothing {
  header "r17c pgp pin set"

  section "openpgp"
  print $"  ($DIM)setting user PIN (PW1)($RESET)"
  let script = "
set timeout 30
spawn gpg --card-edit
expect \"gpg/card>\"
send \"admin\\r\"
expect \"gpg/card>\"
send \"passwd\\r\"
expect \"Your selection?\"
send \"1\\r\"
interact
"
  ^expect -c $script
}

# Set OpenPGP admin PIN
def "main pgp pin admin" []: nothing -> nothing {
  header "r17c pgp pin admin"

  section "openpgp"
  print $"  ($DIM)setting admin PIN (PW3)($RESET)"
  let script = "
set timeout 30
spawn gpg --card-edit
expect \"gpg/card>\"
send \"admin\\r\"
expect \"gpg/card>\"
send \"passwd\\r\"
expect \"Your selection?\"
send \"3\\r\"
interact
"
  ^expect -c $script
}

# List OATH accounts
def "main oath" []: nothing -> nothing {
  header "r17c oath"

  section "oath"
  let result = (do { ^ykman -r "r17c" oath accounts list } | complete)
  if $result.exit_code == 0 and ($result.stdout | str trim | is-not-empty) {
    $result.stdout | lines | each { |l| pass ($l | str trim) } | ignore
  } else if $result.exit_code == 0 {
    print $"  ($DIM)no accounts($RESET)"
  } else {
    fail "ykman oath accounts list" $result.stderr
  }
}

# Show TOTP/HOTP codes [name]
def "main oath code" [name?: string]: nothing -> nothing {
  header "r17c oath code"

  section "oath"
  let result = if ($name | is-not-empty) {
    do { ^ykman -r "r17c" oath accounts code $name } | complete
  } else {
    do { ^ykman -r "r17c" oath accounts code } | complete
  }
  if $result.exit_code == 0 {
    $result.stdout | lines | where { |l| ($l | str trim) != "" } | each { |l| pass ($l | str trim) } | ignore
  } else {
    fail "ykman oath accounts code" $result.stderr
  }
}

# Add TOTP credential <name> <secret>
def "main oath add" [name: string, secret: string]: nothing -> nothing {
  header "r17c oath add"

  section "oath"
  let result = (do { ^ykman -r "r17c" oath accounts add $name $secret --force } | complete)
  if $result.exit_code == 0 {
    pass $"added ($name)"
  } else {
    fail $"add ($name)" $result.stderr
  }
}

# Remove credential <name>
def "main oath delete" [name: string]: nothing -> nothing {
  header "r17c oath delete"

  section "oath"
  let result = (do { ^ykman -r "r17c" oath accounts delete $name --force } | complete)
  if $result.exit_code == 0 {
    pass $"deleted ($name)"
  } else {
    fail $"delete ($name)" $result.stderr
  }
}
