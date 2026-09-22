# r17c

Security key firmware for Raspberry Pi Pico. A single USB device that handles passkey login, GPG signing, and TOTP codes - replacing three separate tools with one $4 board.

Plugs in as a USB composite device exposing two interfaces: HID for FIDO2/U2F (browsers, SSH, WebAuthn) and CCID for OpenPGP 3.4 smart card and OATH credentials (GnuPG, Yubico Authenticator).

## Key Features

- **FIDO2 Passkey**: register and login on any WebAuthn site (GitHub, Google, Cloudflare, Microsoft, etc.). Works as both security key (2FA) and discoverable passkey (passwordless). `ssh-keygen -t ecdsa-sk -O resident` for hardware-backed SSH keys.
- **Client PIN**: 4+ character PIN with 8 retries before lockout. Required for credential creation and discoverable login. PIN auth uses ECDH P-256 key agreement + AES-256-CBC + HMAC-SHA256 (PIN protocol v1).
- **OpenPGP Smart Card**: three P-256 key slots (sign/decrypt/auth). Generate keys on-device or import existing. Works with `gpg --card-status`, `gpg --sign`, `gpg --decrypt`. Card detected via macOS Apple PCSC framework or Linux pcscd.
- **OATH**: TOTP and HOTP credentials compatible with Yubico Authenticator (`ykman`). Up to 16 accounts. Challenge-response via HMAC-SHA1.
- **Credential Storage**: 16 resident key slots (discoverable passkeys), 16 OATH slots. Non-resident credentials are unlimited (stateless key wrapping). All credential storage survives firmware re-flash (separate flash regions).
- **U2F Backward Compatibility**: sites that only support the older U2F/CTAP1 protocol work transparently. GetInfo advertises `U2F_V2` + `FIDO_2_0`.
- **Credential Management**: enumerate and delete resident keys via `credMgmt` and `credentialMgmtPreview` (0x0A + 0x41). Compatible with libfido2 and Chrome DevTools.

## Hardware

- Board: Raspberry Pi Pico (RP2040, Cortex-M0+ dual-core @ 133 MHz, `thumbv6m-none-eabi`)
- Flash: 2 MB Winbond W25Q (firmware ~247KB, rest is credential/key storage)
- RAM: 264 KB SRAM, 64 KB heap
- LED: GP25 (heartbeat 1Hz, 80ms blink = waiting UP, 30ms flash = busy, 6x100ms = wink)
- User Presence: BOOTSEL button (active = grounded via QSPI CS, read from RAM trampoline)
- RNG: ROSC random bit sampling (8 bits per byte, bit-shifted accumulation)
- USB: Full Speed 1.1 (12 Mbps) - VID `0x2E8A`, PID `0x000A`, 100 mA
- AAGUID: `72313763-f1d0-4a00-8000-000000000001`

## USB Topology

```
r17c security key (VID 0x2e8a, PID 0x000a)
├── Configuration 1 (100 mA)
│   ├── Interface 0: HID (FIDO2/CTAP)
│   │   ├── EP IN  (64B, interrupt, 5ms)
│   │   └── EP OUT (64B, interrupt)
│   └── Interface 1: Smart Card (CCID)
│       ├── EP OUT (64B, bulk)
│       ├── EP IN  (64B, bulk)
│       └── EP IN  (8B, interrupt, 32ms)
└── IAD: bDeviceClass=0xEF (Miscellaneous)
```

Interface 0 uses FIDO Alliance Usage Page (`0xF1D0`) with 64-byte IN/OUT reports per CTAPHID spec. Keepalive packets send `STATUS_PROCESSING` (0x01) during crypto and `STATUS_UPNEEDED` (0x02) during user presence wait. Incoming `CTAPHID_CANCEL` is handled during CBOR processing.

Interface 1 presents a CCID 1.1 smart card reader with ATR `3B:DA:18:FF:81:B1:FE:75:1F:03:00:31:C5:73:C0:01:40:00:90:00:0C`. macOS loads `usbsmartcardreaderd` automatically. Application dispatch by AID: `D2 76 00 01 24 01` selects OpenPGP 3.4, `A0 00 00 05 27 21 01` selects OATH.

## Flash Memory Map

```
0x10000000 ┌────────────────────────┐
           │ r17c firmware          │  ~247 KB
0x1003E000 ├────────────────────────┤
           │ (unused)               │  ~8 KB
0x10040000 ├────────────────────────┤
           │ Key storage            │  4 KB (master secret, PIN hash, retries, magic)
0x10041000 ├────────────────────────┤
           │ Monotonic counter      │  4 KB (1024 x 32-bit slots, binary search)
0x10042000 ├────────────────────────┤
           │ Resident keys          │  4 KB (16 slots x 256 bytes)
0x10043000 ├────────────────────────┤
           │ Resident key staging   │  4 KB (compaction target)
0x10050000 ├────────────────────────┤
           │ OpenPGP storage        │  4 KB (keys, PINs, fingerprints, sig counter)
0x10060000 ├────────────────────────┤
           │ OATH credentials       │  4 KB (16 slots x 192 bytes)
0x10061000 ├────────────────────────┤
           │ OATH staging           │  4 KB (compaction target)
0x10062000 ├────────────────────────┤
           │ (unused)               │  ~1656 KB
0x10200000 └────────────────────────┘  ← 2 MB boundary
```

The board shipped from factory with MicroPython v1.17 (Sep 2021) - 281 KB firmware + 1408 KB embedded filesystem filling most of the 2 MB flash. A `main.py` on the filesystem ran a counter loop that suppressed the REPL, making the board appear unresponsive over serial. After entering BOOTSEL mode and inspecting with `picotool info -a`, the stock firmware was identified and wiped. r17c replaces it with 247 KB of firmware + 32 KB structured storage across 7 sectors, leaving ~1.6 MB free. UF2 flash only writes the code region - credential data survives re-flash.

All storage regions are sector-aligned (4096 bytes). RP2040 flash bits can only be cleared (1→0); setting bits (0→1) requires a full sector erase. Staging sectors exist for compaction: live entries are copied to staging, main sector erased, then copied back. Flash magic `R17F` (`52 31 37 46`) at offset 256 validates initialization.

### MicroPython → r17c

| Aspect | Previous (MicroPython) | Current (r17c) | Status |
|--------|----------------------|----------------|--------|
| Firmware | MicroPython v1.17 | r17c v0.1.0 | **Flashed** |
| USB PID | `0x0005` (CDC) | `0x000a` (composite) | Changed |
| Interfaces | 2 (CDC ACM serial) | 2 (HID + CCID) | Changed |
| HID | None | FIDO2 CTAP HID | **Active** |
| CCID | None | OpenPGP + OATH | **Active** |
| Serial port | `/dev/cu.usbmodem101` | None | Removed |
| macOS HID driver | N/A | `AppleUserUSBHostHIDDevice` | Loaded |
| macOS CCID driver | N/A | `usbsmartcardreaderd` | Loaded |
| Power draw | 250 mA | 100 mA | Reduced |

## Build

```
nix develop .#r17c    # defined in nix/devShells.nix

cargo build --release
cargo clippy --release -- -D warnings
```

Default target is `thumbv6m-none-eabi` (set in `.cargo/config.toml`). Crypto tests use `#[cfg(test)]` but the full lib crate cannot compile for host due to embassy/hardware dependencies.

## Flash

```
# Automated (build + convert + copy):
nix run .#r17c -- flash

# Manual:
picotool uf2 convert target/thumbv6m-none-eabi/release/r17c -t elf target/r17c.uf2 --family rp2040

# Hold BOOTSEL + plug in Pico, then:
cp target/r17c.uf2 /Volumes/RPI-RP2/       # macOS
cp target/r17c.uf2 /run/media/*/RPI-RP2/    # Linux
```

## Device Interaction

The `r17c` CLI wraps all tools below. Use `r17c info passkey|pgp|oath` for quick access or the raw commands for debugging.

FIDO2 (via libfido2):
```
fido2-token -L                              # list devices
fido2-token -I <device>                     # device info (GetInfo)
fido2-token -S <device>                     # set PIN
fido2-token -C <device>                     # change PIN
fido2-token -R <device>                     # factory reset (within 10s of boot)
fido2-token -L -r <device>                  # list resident credentials
```

OpenPGP (via GnuPG - requires scdaemon PCSC config):
```
gpg --card-status                           # card info, key fingerprints
```

scdaemon.conf (macOS):
```
pcsc-driver /System/Library/Frameworks/PCSC.framework/Versions/A/PCSC
disable-ccid
pcsc-shared
card-timeout 5
```

OATH (via ykman):
```
ykman -r 'r17c' oath accounts list          # list credentials
ykman -r 'r17c' oath accounts add <n> <s>   # add TOTP
ykman -r 'r17c' oath accounts code           # generate codes
ykman -r 'r17c' oath accounts delete <n>     # remove credential
```

## CLI

```
nix run .#r17c                      # usage
nix run .#r17c -- verify            # 10-check device verification suite
nix run .#r17c -- verify --pin <p>  # non-interactive (auto-sets PIN if needed)
nix run .#r17c -- verify --skip-oath
```

### Device

```
r17c status                         # unified FIDO2 + OpenPGP + OATH view
r17c pin set                        # set passkey PIN (auto-detects change vs new)
r17c pin change                     # change passkey PIN
r17c credentials                    # list stored passkeys (requires PIN)
r17c reset                          # factory reset (within 10s of boot)
r17c wink                           # blink LED to identify device
r17c flash                          # build + UF2 convert + auto-flash
r17c info passkey                   # raw FIDO2 GetInfo
r17c info pgp                       # gpg --card-status
r17c info oath                      # ykman oath info
```

### OpenPGP

```
r17c pgp                            # card status
r17c pgp keygen                     # generate sign/enc/auth keys on card
r17c pgp import <keygrip>           # import existing key to card
r17c pgp pin set                    # set user PIN
r17c pgp pin admin                  # set admin PIN
```

### OATH

```
r17c oath                           # list accounts
r17c oath code [name]               # show TOTP/HOTP codes
r17c oath add <name> <secret>       # add credential
r17c oath delete <name>             # remove credential
```

### Integration

`universe status` delegates to `r17c status` when the r17c binary is in PATH.

## Factory Reset

CTAP2 requires reset to happen within 10 seconds of power-on. This prevents malware from wiping a plugged-in key remotely. To reset: unplug the device, plug it back in, then run `fido2-token -R` within 10 seconds. After the window closes, reset returns `FIDO_ERR_NOT_ALLOWED` until the next replug. Reset erases all FIDO2 credentials, PIN, and counter - OpenPGP and OATH storage are not affected.

## Limitations

- No NFC/Bluetooth (standard Pico, not Pico W)
- No secure element - keys on flash are extractable with physical access
- No RSA (too slow on Cortex-M0+, ECDSA P-256 only)
- No biometrics (UP = BOOTSEL button only)
- No synced passkeys (device-bound: BE=0, BS=0)
