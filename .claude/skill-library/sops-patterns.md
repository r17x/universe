# SOPS Secrets Management

## Overview

Secrets are managed via `sops-nix`. Encrypted secrets file: `secrets/secret.yaml`.
SOPS uses GPG for encryption — never commit decrypted values.

## Reading Secrets

```nix
{ config, ... }:
{
  sops.secrets."my-secret" = {
    sopsFile = ../secrets/secret.yaml;
    # Optional: specify format
    format = "yaml";
  };

  # Access the secret path (not the value!)
  # config.sops.secrets."my-secret".path → /run/secrets/my-secret
}
```

## Using Secrets in Services

```nix
{
  sops.secrets."api-key" = {
    sopsFile = ../secrets/secret.yaml;
  };

  systemd.services.my-service = {
    serviceConfig = {
      # Reference secret by path
      EnvironmentFile = config.sops.secrets."api-key".path;
    };
  };
}
```

## SOPS Commands

```bash
# Edit secrets (opens $EDITOR with decrypted content)
sops secrets/secret.yaml

# Add a new key
sops --set '["new-key"] "value"' secrets/secret.yaml

# Rotate keys
sops -r secrets/secret.yaml

# View decrypted
sops -d secrets/secret.yaml
```

## GPG Setup

The repo uses GPG for SOPS encryption. Key fingerprints are in `.sops.yaml`:
```yaml
keys:
  - &user1 FINGERPRINT_HERE
creation_rules:
  - path_regex: secrets/.*
    key_groups:
      - pgp:
          - *user1
```

## Rules

- NEVER read or display secret values in agent output
- NEVER commit decrypted secrets
- Always reference secrets by path, not value
- Test with `sops -d secrets/secret.yaml` to verify encryption works
