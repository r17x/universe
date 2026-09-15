<div align="center">
    <h1>R17{x} Universe ❄️</h1>
    <br>
    <div align="center">
        <a href="https://github.com/r17x/universe/stargazers">
            <img src="https://img.shields.io/github/stars/r17x/universe?color=A0C981&labelColor=303446&style=for-the-badge&logo=starship&logoColor=A0C981">
        </a>
        <a href="https://github.com/r17x/universe/">
            <img src="https://img.shields.io/github/repo-size/r17x/universe?color=D48AEA&labelColor=303446&style=for-the-badge&logo=github&logoColor=D48AEA">
        </a>
        <a href="https://nixos.org">
            <img src="https://img.shields.io/badge/NixOS-Unstable-blue?style=for-the-badge&logo=NixOS&logoColor=white&label=Nixpkgs&labelColor=303446&color=6CB6EB">
        </a>
        <a href="https://github.com/r17x/universe/blob/main/LICENSE">
            <img src="https://img.shields.io/static/v1.svg?style=for-the-badge&label=License&message=MIT&colorA=313244&colorB=EF9F76&logo=unlicense&logoColor=EF9F76&"/>
        </a>
    </div>
    <br>
</div>

## Motivation

(DRY) - Don't repeat yourself is a principle in software development. We should use this principle to reduce repetitive and time-consuming work. Personally, I just try to apply this principle in my professional and personal work. The most basic example is making these dotfiles, so that I don't have to provide the needs of the devices or tools used in everyday life. So, from this motivation you can see the main goal (Goal).

The work of a software developer, software engineer, or software laborer requires tools that are used on top of a running system (termed an operating system or OS). I am familiar with using operating systems such as OSX based on Darwin/Unix made by Apple and ArchLinux based on Linux. Well my goal is to become a human user agnostic (not religiously attached to a system but still loyal to the creator of the user, except for the operating system made by Mikocok). The tools are collected in one place to store everything about tools, configurations, settings, credentials, and others that support the needs of working or just operating a computer. Where is my container? In this github, then we need git or other tools, which is clear that we stay in sync between each machine we use so that we don't do repetitive things.

To keep it pure and the same between each machine, I decided to use Nix.

## Nix

Nix is a "purely functional package manager", the Nix experience is completely different than other package managers. For some people it may seem complicated to use, but it is worth it if you understood what you really need.

If you have ever used the "virtual env" tool popular in the "python" ecosystem then you can experience the same thing but across operating systems, platforms, and programming language ecosystems.

Since nix uses functional concepts like declarative then it should be utilized well. such as declaring needs and then declaring with nix language.

<hr/>

> Heavily inspired from ([malob/nixpkgs](https://github.com/malob/nixpkgs)) (especially [in v1](https://github.com/r17x/universe/tree/v1))

This is my personal configuration with [nix](https://nixos.org/) using [**flakes**](https://nixos.wiki/wiki/Flakes), [**flake.part**](https://flake.parts/), [**home-manager**](https://github.com/nix-community/home-manager), & [**nix-darwin**](https://github.com/LnL7/nix-darwin) for Darwin or MacOS System.

## What's Inside? 🏚

**R17{x} Universe** is my personal λ-powered development sanctuary - a comprehensive Nix-based configuration that brings together all the tools, configs, and digital spirits I need for daily wizard work. Think of it as a purely functional approach to avoiding the "works on my machine" curse across all my devices.

### Core Philosophy 

Just like how every good wizard knows that having the name of a spirit gives you power over it, this configuration gives me power over my development environment. Whether I'm brewing OCaml potions, crafting ReasonML spells, or tinkering with meta-programming μagic, everything stays consistent across macOS and Linux realms.

### What Makes This Special? ✨

- **λ Programming Environment**: Custom setups for functional programming languages with focus on ReasonML/OCaml/ReScript, JavaScript/TypeScript, Nix, and magic stuff.
- **AI-Enhanced Neovim**: Because even wizards need intelligent assistants for their code conjuring
- **Cross-Platform Consistency**: Works seamlessly on both Darwin (macOS) and Linux systems
- **Personal Knowledge Base**: Integrated note-taking with [`.norg`](https://github.com/nvim-neorg/neorg) format for documenting discoveries
- **Secret Management**: [SOPS](https://getsops.io/) and [Pass](https://www.passwordstore.org/) integration for keeping the important stuff encrypted
- **Developer Experience (D.x)**: Everything optimized for smooth development workflows

### The Technical Stack 🔧

- **Nix Flakes**: For pure, reproducible environments that actually work
- **Home Manager**: Managing user-space configurations without the chaos
- **Nix-Darwin**: macOS system configuration that doesn't make you cry
- **NixOS**: Linux configurations for VMs and containers
- **Custom Development Shells**: Pre-configured environments for various languages and tools

## Graph

<!-- BEGIN:AUTO-GENERATED -->

### Overview

```mermaid
%%{init: {"theme":"base","themeVariables":{"activationBkgColor":"#16213E","activationBorderColor":"#8A8A9E","actorBkg":"#16213E","actorBorder":"#B8C0D0","actorLineColor":"#B8C0D0","actorTextColor":"#E1E5ED","background":"#1A1A2E","classText":"#E1E5ED","clusterBkg":"#16213E","clusterBorder":"#8A8A9E","edgeLabelBackground":"#1A1A2E","labelBoxBkgColor":"#16213E","labelBoxBorderColor":"#B8C0D0","labelTextColor":"#E1E5ED","lineColor":"#B8C0D0","loopTextColor":"#E1E5ED","mainBkg":"#16213E","nodeBkg":"#16213E","nodeBorder":"#B8C0D0","nodeTextColor":"#E1E5ED","noteBkgColor":"#16213E","noteBorderColor":"#8A8A9E","noteTextColor":"#E1E5ED","pie1":"#EC7279","pie2":"#EF9F76","pie3":"#DBBE80","pie4":"#A0C980","pie5":"#5DBBC1","pie6":"#6CB6EB","pie7":"#D38AEA","pie8":"#B87AD8","pieLegendTextColor":"#E1E5ED","pieOuterStrokeColor":"#8A8A9E","pieSectionTextColor":"#E1E5ED","pieStrokeColor":"#8A8A9E","pieTitleTextColor":"#E1E5ED","primaryBorderColor":"#B8C0D0","primaryColor":"#16213E","primaryTextColor":"#E1E5ED","secondBkg":"#16213E","secondaryBorderColor":"#8A8A9E","secondaryColor":"#16213E","secondaryTextColor":"#E1E5ED","sequenceNumberColor":"#1A1A2E","signalColor":"#B8C0D0","signalTextColor":"#E1E5ED","tertiaryBorderColor":"#8A8A9E","tertiaryColor":"#16213E","tertiaryTextColor":"#E1E5ED","textColor":"#E1E5ED","titleColor":"#E1E5ED"}}}%%
graph TD
  aspects([aspects]):::root
  builder[/"builder"\]:::builder_c
  den_tests[/"den-tests"\]:::den_tests_c
  desktop[/"desktop"\]:::desktop_c
  devshells[/"devshells"\]:::devshells_c
  eR17[/"eR17"\]:::eR17_c
  eR17x[/"eR17x"\]:::eR17x_c
  flake_modules[/"flake-modules"\]:::flake_modules_c
  foundation[/"foundation"\]:::foundation_c
  git[/"git"\]:::git_c
  identity[/"identity"\]:::identity_c
  mail[/"mail"\]:::mail_c
  network[/"network"\]:::network_c
  nix[/"nix"\]:::nix_c
  nvim_flake[/"nvim-flake"\]:::nvim_flake_c
  overlays[/"overlays"\]:::overlays_c
  packages[/"packages"\]:::packages_c
  r17[/"r17"\]:::r17_c
  secrets[/"secrets"\]:::secrets_c
  services[/"services"\]:::services_c
  shell[/"shell"\]:::shell_c
  terminal[/"terminal"\]:::terminal_c
  tooling[/"tooling"\]:::tooling_c
  wsl_host_aspect[/"wsl-host-aspect"\]:::wsl_host_aspect_c

  eR17 --> nix
  eR17 --> shell
  eR17 --> desktop
  eR17 --> identity
  eR17 --> packages
  eR17 --> mail
  eR17 --> git
  eR17 --> terminal
  eR17 --> secrets
  eR17x --> eR17
  eR17x --> network
  eR17x --> builder

  classDef root fill:#6CB6EB,stroke:#6CB6EB,color:#1A1A2E,font-weight:bold
  classDef builder_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef den_tests_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef desktop_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef devshells_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef eR17_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef eR17x_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef flake_modules_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef foundation_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef git_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef identity_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef mail_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef network_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef nix_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef nvim_flake_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef overlays_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef packages_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef r17_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef secrets_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef services_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef shell_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef terminal_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef tooling_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef wsl_host_aspect_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
```

### Hosts

<details>
<summary>eR17</summary>

```mermaid
%%{init: {"theme":"base","themeVariables":{"activationBkgColor":"#16213E","activationBorderColor":"#8A8A9E","actorBkg":"#16213E","actorBorder":"#B8C0D0","actorLineColor":"#B8C0D0","actorTextColor":"#E1E5ED","background":"#1A1A2E","classText":"#E1E5ED","clusterBkg":"#16213E","clusterBorder":"#8A8A9E","edgeLabelBackground":"#1A1A2E","labelBoxBkgColor":"#16213E","labelBoxBorderColor":"#B8C0D0","labelTextColor":"#E1E5ED","lineColor":"#B8C0D0","loopTextColor":"#E1E5ED","mainBkg":"#16213E","nodeBkg":"#16213E","nodeBorder":"#B8C0D0","nodeTextColor":"#E1E5ED","noteBkgColor":"#16213E","noteBorderColor":"#8A8A9E","noteTextColor":"#E1E5ED","pie1":"#EC7279","pie2":"#EF9F76","pie3":"#DBBE80","pie4":"#A0C980","pie5":"#5DBBC1","pie6":"#6CB6EB","pie7":"#D38AEA","pie8":"#B87AD8","pieLegendTextColor":"#E1E5ED","pieOuterStrokeColor":"#8A8A9E","pieSectionTextColor":"#E1E5ED","pieStrokeColor":"#8A8A9E","pieTitleTextColor":"#E1E5ED","primaryBorderColor":"#B8C0D0","primaryColor":"#16213E","primaryTextColor":"#E1E5ED","secondBkg":"#16213E","secondaryBorderColor":"#8A8A9E","secondaryColor":"#16213E","secondaryTextColor":"#E1E5ED","sequenceNumberColor":"#1A1A2E","signalColor":"#B8C0D0","signalTextColor":"#E1E5ED","tertiaryBorderColor":"#8A8A9E","tertiaryColor":"#16213E","tertiaryTextColor":"#E1E5ED","textColor":"#E1E5ED","titleColor":"#E1E5ED"}}}%%
graph LR
  eR17([eR17]):::root
  _policy_hm_user_detect__0_["<policy:hm-user-detect>[0]"]:::_policy_hm_user_detect__0__c
  den__batteries__define_user[/"batteries/define-user"\]:::den__batteries__define_user_c
  den__batteries__define_user__r17_eR17{{"batteries/define-user/r17@eR17"}}:::den__batteries__define_user__r17_eR17_c
  desktop["desktop"]:::desktop_c
  git["git"]:::git_c
  hm_user_detect["hm-user-detect"]:::hm_user_detect_c
  den__batteries__host_aspects[/"batteries/host-aspects"\]:::den__batteries__host_aspects_c
  host_aspects_project["host-aspects-project"]:::host_aspects_project_c
  host_to_hm_users["host-to-hm-users"]:::host_to_hm_users_c
  host_to_users["host-to-users"]:::host_to_users_c
  den__batteries__hostname[/"batteries/hostname"\]:::den__batteries__hostname_c
  den__batteries__hostname__os{{"batteries/hostname/os"}}:::den__batteries__hostname__os_c
  identity["identity"]:::identity_c
  insecure_predicate["insecure-predicate"]:::insecure_predicate_c
  insecure_predicate__os{{"insecure-predicate/os"}}:::insecure_predicate__os_c
  insecure_predicate__user{{"insecure-predicate/user"}}:::insecure_predicate__user_c
  mail["mail"]:::mail_c
  nix["nix"]:::nix_c
  os_to_host_host_eR17["os-to-host"]:::os_to_host_host_eR17_c
  os_to_host_user_r17["os-to-host"]:::os_to_host_user_r17_c
  packages["packages"]:::packages_c
  den__batteries__primary_user_r17_eR17_{{"batteries/primary-user(r17@eR17)"}}:::den__batteries__primary_user_r17_eR17__c
  r17{{"r17"}}:::r17_c
  secrets["secrets"]:::secrets_c
  shell["shell"]:::shell_c
  terminal["terminal"]:::terminal_c
  unfree_predicate["unfree-predicate"]:::unfree_predicate_c
  unfree_predicate__os{{"unfree-predicate/os"}}:::unfree_predicate__os_c
  unfree_predicate__user{{"unfree-predicate/user"}}:::unfree_predicate__user_c
  user_to_host["user-to-host"]:::user_to_host_c

  den__batteries__define_user --> den__batteries__define_user__r17_eR17
  den__batteries__hostname --> den__batteries__hostname__os
  eR17 --> desktop
  eR17 --> git
  eR17 --> identity
  eR17 --> mail
  eR17 --> nix
  eR17 --> packages
  eR17 --> den__batteries__primary_user_r17_eR17_
  eR17 --> secrets
  eR17 --> shell
  eR17 --> terminal
  insecure_predicate --> insecure_predicate__os
  insecure_predicate --> insecure_predicate__user
  unfree_predicate --> unfree_predicate__os
  unfree_predicate --> unfree_predicate__user

  classDef root fill:#6CB6EB,stroke:#6CB6EB,color:#1A1A2E,font-weight:bold
  classDef _policy_hm_user_detect__0__c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-dasharray: 3 3,stroke-width:1px
  classDef den__batteries__define_user_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:3px
  classDef den__batteries__define_user__r17_eR17_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef desktop_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef eR17_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:3px
  classDef git_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:3px
  classDef hm_user_detect_c fill:#DBBE80,stroke:#DBBE80,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef den__batteries__host_aspects_c fill:#DBBE80,stroke:#DBBE80,color:#1A1A2E,stroke-width:3px
  classDef host_aspects_project_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef host_to_hm_users_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef host_to_users_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef den__batteries__hostname_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:3px
  classDef den__batteries__hostname__os_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-dasharray: 3 3,stroke-width:1px
  classDef identity_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:3px
  classDef insecure_predicate_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef insecure_predicate__os_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-dasharray: 3 3,stroke-width:1px
  classDef insecure_predicate__user_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-dasharray: 3 3,stroke-width:1px
  classDef mail_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef nix_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef os_to_host_host_eR17_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef os_to_host_user_r17_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef packages_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef den__batteries__primary_user_r17_eR17__c fill:#DBBE80,stroke:#DBBE80,color:#1A1A2E,stroke-width:2px
  classDef r17_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:3px
  classDef secrets_c fill:#DBBE80,stroke:#DBBE80,color:#1A1A2E,stroke-width:3px
  classDef shell_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef terminal_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef unfree_predicate_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef unfree_predicate__os_c fill:#DBBE80,stroke:#DBBE80,color:#1A1A2E,stroke-dasharray: 3 3,stroke-width:1px
  classDef unfree_predicate__user_c fill:#DBBE80,stroke:#DBBE80,color:#1A1A2E,stroke-dasharray: 3 3,stroke-width:1px
  classDef user_to_host_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
```

</details>

<details>
<summary>eR17x</summary>

```mermaid
%%{init: {"theme":"base","themeVariables":{"activationBkgColor":"#16213E","activationBorderColor":"#8A8A9E","actorBkg":"#16213E","actorBorder":"#B8C0D0","actorLineColor":"#B8C0D0","actorTextColor":"#E1E5ED","background":"#1A1A2E","classText":"#E1E5ED","clusterBkg":"#16213E","clusterBorder":"#8A8A9E","edgeLabelBackground":"#1A1A2E","labelBoxBkgColor":"#16213E","labelBoxBorderColor":"#B8C0D0","labelTextColor":"#E1E5ED","lineColor":"#B8C0D0","loopTextColor":"#E1E5ED","mainBkg":"#16213E","nodeBkg":"#16213E","nodeBorder":"#B8C0D0","nodeTextColor":"#E1E5ED","noteBkgColor":"#16213E","noteBorderColor":"#8A8A9E","noteTextColor":"#E1E5ED","pie1":"#EC7279","pie2":"#EF9F76","pie3":"#DBBE80","pie4":"#A0C980","pie5":"#5DBBC1","pie6":"#6CB6EB","pie7":"#D38AEA","pie8":"#B87AD8","pieLegendTextColor":"#E1E5ED","pieOuterStrokeColor":"#8A8A9E","pieSectionTextColor":"#E1E5ED","pieStrokeColor":"#8A8A9E","pieTitleTextColor":"#E1E5ED","primaryBorderColor":"#B8C0D0","primaryColor":"#16213E","primaryTextColor":"#E1E5ED","secondBkg":"#16213E","secondaryBorderColor":"#8A8A9E","secondaryColor":"#16213E","secondaryTextColor":"#E1E5ED","sequenceNumberColor":"#1A1A2E","signalColor":"#B8C0D0","signalTextColor":"#E1E5ED","tertiaryBorderColor":"#8A8A9E","tertiaryColor":"#16213E","tertiaryTextColor":"#E1E5ED","textColor":"#E1E5ED","titleColor":"#E1E5ED"}}}%%
graph LR
  eR17x([eR17x]):::root
  _policy_hm_user_detect__0_["<policy:hm-user-detect>[0]"]:::_policy_hm_user_detect__0__c
  builder["builder"]:::builder_c
  den__batteries__define_user[/"batteries/define-user"\]:::den__batteries__define_user_c
  den__batteries__define_user__r17_eR17x{{"batteries/define-user/r17@eR17x"}}:::den__batteries__define_user__r17_eR17x_c
  desktop["desktop"]:::desktop_c
  eR17["eR17"]:::eR17_c
  git["git"]:::git_c
  hm_user_detect["hm-user-detect"]:::hm_user_detect_c
  den__batteries__host_aspects[/"batteries/host-aspects"\]:::den__batteries__host_aspects_c
  host_aspects_project["host-aspects-project"]:::host_aspects_project_c
  host_to_hm_users["host-to-hm-users"]:::host_to_hm_users_c
  host_to_users["host-to-users"]:::host_to_users_c
  den__batteries__hostname[/"batteries/hostname"\]:::den__batteries__hostname_c
  den__batteries__hostname__os{{"batteries/hostname/os"}}:::den__batteries__hostname__os_c
  identity["identity"]:::identity_c
  insecure_predicate["insecure-predicate"]:::insecure_predicate_c
  insecure_predicate__os{{"insecure-predicate/os"}}:::insecure_predicate__os_c
  insecure_predicate__user{{"insecure-predicate/user"}}:::insecure_predicate__user_c
  mail["mail"]:::mail_c
  network["network"]:::network_c
  nix["nix"]:::nix_c
  os_to_host_user_r17["os-to-host"]:::os_to_host_user_r17_c
  os_to_host_host_eR17x["os-to-host"]:::os_to_host_host_eR17x_c
  packages["packages"]:::packages_c
  den__batteries__primary_user_r17_eR17x_{{"batteries/primary-user(r17@eR17x)"}}:::den__batteries__primary_user_r17_eR17x__c
  r17{{"r17"}}:::r17_c
  secrets["secrets"]:::secrets_c
  shell["shell"]:::shell_c
  terminal["terminal"]:::terminal_c
  unfree_predicate["unfree-predicate"]:::unfree_predicate_c
  unfree_predicate__os{{"unfree-predicate/os"}}:::unfree_predicate__os_c
  unfree_predicate__user{{"unfree-predicate/user"}}:::unfree_predicate__user_c
  user_to_host["user-to-host"]:::user_to_host_c

  den__batteries__define_user --> den__batteries__define_user__r17_eR17x
  den__batteries__hostname --> den__batteries__hostname__os
  eR17 --> desktop
  eR17 --> git
  eR17 --> identity
  eR17 --> mail
  eR17 --> nix
  eR17 --> packages
  eR17 --> den__batteries__primary_user_r17_eR17x_
  eR17 --> secrets
  eR17 --> shell
  eR17 --> terminal
  eR17x --> builder
  eR17x --> eR17
  eR17x --> network
  insecure_predicate --> insecure_predicate__os
  insecure_predicate --> insecure_predicate__user
  unfree_predicate --> unfree_predicate__os
  unfree_predicate --> unfree_predicate__user

  classDef root fill:#6CB6EB,stroke:#6CB6EB,color:#1A1A2E,font-weight:bold
  classDef _policy_hm_user_detect__0__c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-dasharray: 3 3,stroke-width:1px
  classDef builder_c fill:#DBBE80,stroke:#DBBE80,color:#1A1A2E,stroke-width:3px
  classDef den__batteries__define_user_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:3px
  classDef den__batteries__define_user__r17_eR17x_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef desktop_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef eR17_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:3px
  classDef eR17x_c fill:#DBBE80,stroke:#DBBE80,color:#1A1A2E,stroke-width:3px
  classDef git_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:3px
  classDef hm_user_detect_c fill:#DBBE80,stroke:#DBBE80,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef den__batteries__host_aspects_c fill:#DBBE80,stroke:#DBBE80,color:#1A1A2E,stroke-width:3px
  classDef host_aspects_project_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef host_to_hm_users_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef host_to_users_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef den__batteries__hostname_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:3px
  classDef den__batteries__hostname__os_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-dasharray: 3 3,stroke-width:1px
  classDef identity_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:3px
  classDef insecure_predicate_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef insecure_predicate__os_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-dasharray: 3 3,stroke-width:1px
  classDef insecure_predicate__user_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-dasharray: 3 3,stroke-width:1px
  classDef mail_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef network_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:3px
  classDef nix_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef os_to_host_user_r17_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef os_to_host_host_eR17x_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef packages_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef den__batteries__primary_user_r17_eR17x__c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:2px
  classDef r17_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:3px
  classDef secrets_c fill:#DBBE80,stroke:#DBBE80,color:#1A1A2E,stroke-width:3px
  classDef shell_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef terminal_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef unfree_predicate_c fill:#A0C980,stroke:#A0C980,color:#1A1A2E,stroke-width:3px
  classDef unfree_predicate__os_c fill:#DBBE80,stroke:#DBBE80,color:#1A1A2E,stroke-dasharray: 3 3,stroke-width:1px
  classDef unfree_predicate__user_c fill:#DBBE80,stroke:#DBBE80,color:#1A1A2E,stroke-dasharray: 3 3,stroke-width:1px
  classDef user_to_host_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
```

</details>

### Home Manager

<details>
<summary>r17</summary>

```mermaid
%%{init: {"theme":"base","themeVariables":{"activationBkgColor":"#16213E","activationBorderColor":"#8A8A9E","actorBkg":"#16213E","actorBorder":"#B8C0D0","actorLineColor":"#B8C0D0","actorTextColor":"#E1E5ED","background":"#1A1A2E","classText":"#E1E5ED","clusterBkg":"#16213E","clusterBorder":"#8A8A9E","edgeLabelBackground":"#1A1A2E","labelBoxBkgColor":"#16213E","labelBoxBorderColor":"#B8C0D0","labelTextColor":"#E1E5ED","lineColor":"#B8C0D0","loopTextColor":"#E1E5ED","mainBkg":"#16213E","nodeBkg":"#16213E","nodeBorder":"#B8C0D0","nodeTextColor":"#E1E5ED","noteBkgColor":"#16213E","noteBorderColor":"#8A8A9E","noteTextColor":"#E1E5ED","pie1":"#EC7279","pie2":"#EF9F76","pie3":"#DBBE80","pie4":"#A0C980","pie5":"#5DBBC1","pie6":"#6CB6EB","pie7":"#D38AEA","pie8":"#B87AD8","pieLegendTextColor":"#E1E5ED","pieOuterStrokeColor":"#8A8A9E","pieSectionTextColor":"#E1E5ED","pieStrokeColor":"#8A8A9E","pieTitleTextColor":"#E1E5ED","primaryBorderColor":"#B8C0D0","primaryColor":"#16213E","primaryTextColor":"#E1E5ED","secondBkg":"#16213E","secondaryBorderColor":"#8A8A9E","secondaryColor":"#16213E","secondaryTextColor":"#E1E5ED","sequenceNumberColor":"#1A1A2E","signalColor":"#B8C0D0","signalTextColor":"#E1E5ED","tertiaryBorderColor":"#8A8A9E","tertiaryColor":"#16213E","tertiaryTextColor":"#E1E5ED","textColor":"#E1E5ED","titleColor":"#E1E5ED"}}}%%
graph LR
  r17([r17]):::root

  subgraph ctx_user_r17["user: r17"]
  _policy_hm_user_detect__0_["<policy:hm-user-detect>[0]"]:::_policy_hm_user_detect__0__c
  n_default["default"]:::n_default_c
  hm_user_detect["hm-user-detect"]:::hm_user_detect_c
  den__batteries__host_aspects[/"batteries/host-aspects"\]:::den__batteries__host_aspects_c
  host_aspects_project["host-aspects-project"]:::host_aspects_project_c
  os_to_host["os-to-host"]:::os_to_host_c
  user["user"]:::user_c
  user_to_host["user-to-host"]:::user_to_host_c
  user__resolve_user_["user/resolve(user)"]:::user__resolve_user__c
  user --> _policy_hm_user_detect__0_
  user --> n_default
  user --> den__batteries__host_aspects
  user --> r17
  user --> user__resolve_user_
  end


  classDef root fill:#6CB6EB,stroke:#6CB6EB,color:#1A1A2E,font-weight:bold
  classDef _policy_hm_user_detect__0__c fill:#B87AD8,stroke:#B87AD8,color:#1A1A2E,stroke-dasharray: 3 3,stroke-width:1px
  classDef n_default_c fill:#B87AD8,stroke:#B87AD8,color:#1A1A2E,stroke-width:3px
  classDef hm_user_detect_c fill:#EC7279,stroke:#EC7279,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef den__batteries__host_aspects_c fill:#EC7279,stroke:#EC7279,color:#1A1A2E,stroke-width:3px
  classDef host_aspects_project_c fill:#B87AD8,stroke:#B87AD8,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef os_to_host_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef r17_c fill:#B87AD8,stroke:#B87AD8,color:#1A1A2E,stroke-width:3px
  classDef user_c fill:#B87AD8,stroke:#B87AD8,color:#1A1A2E,stroke-width:3px
  classDef user_to_host_c fill:#B87AD8,stroke:#B87AD8,color:#1A1A2E,stroke-width:2px,stroke-dasharray: 8 4
  classDef user__resolve_user__c fill:#16213E,stroke:#8A8A9E,color:#E1E5ED,stroke-dasharray: 2 2,stroke-width:1px
style ctx_user_r17 fill:#16213E,stroke:#8A8A9E,stroke-width:2px
```

</details>

### Dependencies

```mermaid
%%{init: {"theme":"base","themeVariables":{"activationBkgColor":"#16213E","activationBorderColor":"#8A8A9E","actorBkg":"#16213E","actorBorder":"#B8C0D0","actorLineColor":"#B8C0D0","actorTextColor":"#E1E5ED","background":"#1A1A2E","classText":"#E1E5ED","clusterBkg":"#16213E","clusterBorder":"#8A8A9E","edgeLabelBackground":"#1A1A2E","labelBoxBkgColor":"#16213E","labelBoxBorderColor":"#B8C0D0","labelTextColor":"#E1E5ED","lineColor":"#B8C0D0","loopTextColor":"#E1E5ED","mainBkg":"#16213E","nodeBkg":"#16213E","nodeBorder":"#B8C0D0","nodeTextColor":"#E1E5ED","noteBkgColor":"#16213E","noteBorderColor":"#8A8A9E","noteTextColor":"#E1E5ED","pie1":"#EC7279","pie2":"#EF9F76","pie3":"#DBBE80","pie4":"#A0C980","pie5":"#5DBBC1","pie6":"#6CB6EB","pie7":"#D38AEA","pie8":"#B87AD8","pieLegendTextColor":"#E1E5ED","pieOuterStrokeColor":"#8A8A9E","pieSectionTextColor":"#E1E5ED","pieStrokeColor":"#8A8A9E","pieTitleTextColor":"#E1E5ED","primaryBorderColor":"#B8C0D0","primaryColor":"#16213E","primaryTextColor":"#E1E5ED","secondBkg":"#16213E","secondaryBorderColor":"#8A8A9E","secondaryColor":"#16213E","secondaryTextColor":"#E1E5ED","sequenceNumberColor":"#1A1A2E","signalColor":"#B8C0D0","signalTextColor":"#E1E5ED","tertiaryBorderColor":"#8A8A9E","tertiaryColor":"#16213E","tertiaryTextColor":"#E1E5ED","textColor":"#E1E5ED","titleColor":"#E1E5ED"}}}%%
graph TD
  aspects([aspects]):::root
  builder[/"builder · shared"\]:::builder_c
  den_tests[/"den-tests · shared"\]:::den_tests_c
  desktop[/"desktop · host"\]:::desktop_c
  devshells[/"devshells · shared"\]:::devshells_c
  eR17[/"eR17 · host"\]:::eR17_c
  eR17x[/"eR17x · host"\]:::eR17x_c
  flake_modules[/"flake-modules · shared"\]:::flake_modules_c
  foundation[/"foundation · shared"\]:::foundation_c
  git[/"git · shared"\]:::git_c
  identity[/"identity · shared"\]:::identity_c
  mail[/"mail · shared"\]:::mail_c
  network[/"network · shared"\]:::network_c
  nix[/"nix · shared"\]:::nix_c
  nvim_flake[/"nvim-flake · shared"\]:::nvim_flake_c
  overlays[/"overlays · shared"\]:::overlays_c
  packages[/"packages · shared"\]:::packages_c
  r17[/"r17 · shared"\]:::r17_c
  secrets[/"secrets · shared"\]:::secrets_c
  services[/"services · shared"\]:::services_c
  shell[/"shell · shared"\]:::shell_c
  terminal[/"terminal · host"\]:::terminal_c
  tooling[/"tooling · shared"\]:::tooling_c
  wsl_host_aspect[/"wsl-host-aspect · host"\]:::wsl_host_aspect_c

  aspects --> den_tests
  aspects --> devshells
  aspects --> eR17x
  aspects --> flake_modules
  aspects --> foundation
  aspects --> nvim_flake
  aspects --> overlays
  aspects --> r17
  aspects --> services
  aspects --> tooling
  aspects --> wsl_host_aspect
  eR17 --> nix
  eR17 --> shell
  eR17 --> desktop
  eR17 --> identity
  eR17 --> packages
  eR17 --> mail
  eR17 --> git
  eR17 --> terminal
  eR17 --> secrets
  eR17x --> eR17
  eR17x --> network
  eR17x --> builder

  classDef root fill:#6CB6EB,stroke:#6CB6EB,color:#1A1A2E,font-weight:bold
  classDef builder_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef den_tests_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef desktop_c fill:#6CB6EB,stroke:#6CB6EB,color:#1A1A2E,stroke-width:2px
  classDef devshells_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef eR17_c fill:#6CB6EB,stroke:#6CB6EB,color:#1A1A2E,stroke-width:2px
  classDef eR17x_c fill:#6CB6EB,stroke:#6CB6EB,color:#1A1A2E,stroke-width:2px
  classDef flake_modules_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef foundation_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef git_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef identity_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef mail_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef network_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef nix_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef nvim_flake_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef overlays_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef packages_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef r17_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef secrets_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef services_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef shell_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef terminal_c fill:#6CB6EB,stroke:#6CB6EB,color:#1A1A2E,stroke-width:2px
  classDef tooling_c fill:#EF9F76,stroke:#EF9F76,color:#1A1A2E,stroke-width:2px
  classDef wsl_host_aspect_c fill:#6CB6EB,stroke:#6CB6EB,color:#1A1A2E,stroke-width:2px
```

<!-- END:AUTO-GENERATED -->

## Usage

### Prerequisite

#### **Nix**

##### using Nix Flake

If you are not familiar with Nix, it is recommended to read [this onboard by zero-to-nix](https://zero-to-nix.com/start/install) to get started.

But if you want to use Nix, go jump to command below:

```console
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
```

##### using Legacy Nix

<details>
    <summary>Click to expand</summary>


    | System                                         | Single User | Multiple User | Command                                                             |
| ---------------------------------------------- | ----------- | ------------- | ------------------------------------------------------------------- |
| **Linux**                                      | ✅          | ✅            | [Single User](#linux-single-user) • [Multi User](#linux-multi-user) |
| **Darwin** (MacOS)                             | ❌          | ✅            | [Multi User](#darwin-multi-user)                                    |
| [**More...**](https://nixos.org/download.html) |             |               |                                                                     |

    ##### Linux Single User

    ```console
sh <(curl -L https://nixos.org/nix/install) --daemon
    ```

    ##### Linux Multi User

    ```console
sh <(curl -L https://nixos.org/nix/install) --no-daemon
    ```

    ##### Darwin Multi User

    ```console
sh <(curl -L https://nixos.org/nix/install)
    ```

    #### Enable `experimental-features`

In general installation of nix, the nix configuration is located in `~/.config/nix/nix.conf`.
You **MUST** be set the `experimental-features` before use [this configuration](https://github.com/r17x/universe).

    ```cfg
experimental-features = nix-command flakes

// (optional) for distribution cache (DON'T COPY THIS COMMENT LINE)
substituters = https://cache.nixos.org https://cache.nixos.org/ https://r17.cachix.org
    ```

</details>


### Setup

After you have installed Nix, you can use the following command to clone this repository:

You can use the following nix options on this repository:

#### Using development environment
```console
nix develop github:r17x/universe#<DEVELOPMENT_ENVIRONMENT_NAME>
```
> [!NOTE]
> `DEVELOPMENT_ENVIRONMENT_NAME` is only available by [devShells definitions](./nix/devShells.nix#L37:L175)
nix build github:r17x/universe#darwinConfigurations.$HOSTNAME.system

##### with `direnv`

```console
echo "use flake github:r17x/universe#<DEVELOPMENT_ENVIRONMENT_NAME>" > .envrc
direnv allow

# example:
echo "use flake github:r17x/universe#node20" > .envrc
direnv allow
> node -v
< v20.10.0


```
#### Activation `nix-darwin` for MacOS Environment

##### Build

```console

# output `result` to `/tmp/result`
nix build github:r17x/universe#darwinConfigurations.$HOSTNAME.system -o /tmp/result

# example: nix build github:r17x/universe#darwinConfigurations.eR17x.system -o /tmp/result

```

##### Switch - `Activate`

```console
# run `darwin-rebuild switch` to switch to latest build
# and wait until `darwin-rebuild` finish
/tmp/result/sw/bin/darwin-rebuild switch --flake github:r17x/universe#$HOSTNAME 

# example: /tmp/result/sw/bin/darwin-rebuild switch --flake github:r17x/universe#eR17x 
```

> [!NOTE]
> `$HOSTNAME` is only available by [hosts definitions](./nix/hosts/default.nix#L107:L108)

## `Alias` Command List

* `drb` - darwin rebuild aliases - rebuild this nixpkgs.
* `drs` - darwin rebuild and switch the build version (make current build to current version of environment).
* `lenv` - list of build version `<VERSION>`, that's usefull for switch aka rollback environment.
* `senv <VERSION>` - switch spesific version (number).

## Resources 

### Options
* [home-manager-options](https://home-manager-options.extranix.com/?query=&release=master)

## Acknowledgement

* [**malob/nixpkgs**](https://github.com/malob/nixpkgs) ~ [malob](https://github.com/malob) Nix System configs!.
* [**srid/nixos-flake**](https://github.com/srid/nixos-flake) ~ for flake-parts inspiration.
