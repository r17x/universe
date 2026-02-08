# Project Overview

## Name
**R17{x} Universe** - Personal Nix-based configuration repository

## Purpose
A comprehensive Nix-based configuration system that manages development environments, system configurations, and tools across multiple machines. The goal is to achieve DRY (Don't Repeat Yourself) principles for personal computing setup using pure, reproducible, and declarative configurations.

## Tech Stack
- **Nix Flakes** - Core configuration management with pure, reproducible environments
- **flake-parts** - Flake composition and modular configuration
- **home-manager** - User-space configuration management
- **nix-darwin** - macOS system configuration
- **NixOS** - Linux configurations (for VMs and containers)
- **SOPS** - Secret management (encrypted secrets)
- **pre-commit hooks** - Code quality checks

## Supported Platforms
- `aarch64-darwin` (Apple Silicon macOS)
- `aarch64-linux`
- `x86_64-linux`

## Key Features
- Cross-platform consistency (Darwin and Linux)
- Functional programming environment (OCaml, ReasonML, ReScript, JavaScript/TypeScript)
- AI-enhanced Neovim configuration
- Multiple development shells for various languages
- Secret management with SOPS
- Process-compose for services (Ollama, MariaDB)

## Repository URL
https://github.com/r17x/universe
