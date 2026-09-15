{ ... }:
let
  systemShell =
    { pkgs, ... }:
    {
      programs.fish.enable = true;
      programs.fish.useBabelfish = true;
      programs.fish.babelfishPackage = pkgs.babelfish;
    };
in
{
  den.aspects.shell = {
    darwin = systemShell;
    nixos = systemShell;

    homeManager =
      {
        color,
        config,
        lib,
        pkgs,
        ...
      }:

      let
        nixConfigDirectory = "~/.config/nixpkgs";
        commandFoldl' = lib.strings.concatMapStrings (x: "${x} && ");
        shellAliases =
          with pkgs;
          let
            verify =
              writeScriptBin "verify" # bash
                ''
                  [[ -z "$1" ]] && echo "No argument provided" && exit 0

                  [[ $1 == ^-?[0-9]+(\.[0-9]+)?$ ]] && echo "The first argument is not a number: $1" && exit 0
                '';
            cmd =
              a: b: x: # bash
              ''
                set -e
                ${verify}/bin/verify $1 || exit 0
                ${git}/bin/git for-each-ref --sort=${a} --format '%(refname:short) %(${a}:format:%s)' "${b}" | while read tag tagdate; do
                  threshold_date=$(date -d "$1 days ago" --utc '+%s')
                  if [ -n "$tagdate" ]; then
                    if [ "$tagdate" -lt "$threshold_date" ]; then
                      echo "==> $tag is older than $1 days"
                      echo "==> $tag  will be deleted"
                      TAGS="$TAGS $tag"
                    fi
                  fi
                done
                ${x} $TAGS
              '';
            scripts = {
              gdb = writeScriptBin "gdb" (cmd "committerdate" "refs/heads" "git branch -D");
              gdbr = writeScriptBin "gdbr" (cmd "committerdate" "origin/refs/heads" "git push origin -d");
              gdt = writeScriptBin "gdt" (cmd "taggerdate" "refs/tags/*" "git tag -d");
              gdtr = writeScriptBin "gdtr" (cmd "taggerdate" "origin/refs/tags/*" "git push origin -d");
            };
          in
          {
            gdb = ''${scripts.gdb}/bin/gdb'';
            gdbr = ''${scripts.gdbr}/bin/gdbr'';
            gdt = ''${scripts.gdt}/bin/gdt'';
            gdtr = ''${scripts.gdtr}/bin/gdtr'';

            tg = "tree --gitignore";
            nclean = commandFoldl' [
              "nix profile wipe-history"
              "nix-collect-garbage"
              "nix-collect-garbage -d"
              "nix-collect-garbage --delete-old"
              "nix store gc"
              "nix store optimise"
              "nix-store --verify --repair --check-contents"
            ];
            da = "direnv allow";
            dr = "direnv reload";
            drb = "darwin-rebuild build --flake ${nixConfigDirectory}";
            drs = "darwin-rebuild switch --flake ${nixConfigDirectory}";
            psc0 = "nix build ${nixConfigDirectory}#darwinConfigurations.RG.system --json | jq -r '.[].outputs | to_entries[].value' | cachix push r17";
            psc1 = "nix build ${nixConfigDirectory}#darwinConfigurations.eR17.system --json | jq -r '.[].outputs | to_entries[].value' | cachix push r17";

            gpbs = "gpg --export-options backup --export-secret-keys";
            gpbp = "gpg --export-options backup --export";
            gprs = "gpg --export-options restore --import";
            gpbt = "gpg --export-ownertrust";
            gprt = "gpg --import-ownertrust";

            lenv = "nix-env --list-generations";
            senv = "nix-env --switch-generation";
            denv = "nix-env --delete-generations";
            doenv = "denv old";
            renv = "nix-env --rollback";
            flakeup-all = "nix flake update ${nixConfigDirectory}";
            flakeup = "nix flake lock ${nixConfigDirectory} --update-input";
            nb = "nix build";
            ndp = "nix develop";
            nf = "nix flake";
            nr = "nix run";
            ns = "nix-shell";
            nq = "nix search";
            age = "${pkgs.rage}/bin/rage";

            e = "nvim";
            grep = "${pkgs.ripgrep}/bin/rg";
            c = "z";
            cc = "zi";
            rm = "rm -i";
            p = "ping";
            l = "ls -l";
            la = "ls -a";
            lla = "ls -la";
            lt = "ls --tree";
            cat = "${pkgs.bat}/bin/bat";
            du = "${pkgs.du-dust}/bin/dust";

            g = "git";
            pullhead = "git pull origin (git rev-parse --abbrev-ref HEAD)";
            beda = "gd";
            ingfo = "git status";
            tarek = "pullhead";
            pushhead = "git push origin (git rev-parse --abbrev-ref HEAD)";
            gas = "pushhead";
            gasin = "pushhead --force";
            gtmp = "git commit -m \"temp\" --no-verify";
            gf = "git flow";
            gl = "git log --graph --oneline --all";
            gll = "git log --oneline --decorate --all --graph --stat";
            gld = "git log --oneline --all --pretty=format:\"%h%x09%an%x09%ad%x09%s\"";
            gls = "gl --show-signature";
            gfa = "git fetch --all";
            grc = "git rebase --continue";
            gri = "git rebase --interactive";

            todo = "nvim ${nixConfigDirectory}/notes/todo.norg";
            todox = "nvim ${nixConfigDirectory}/secrets/todo.norg";
            diary = "nvim ${nixConfigDirectory}/notes/diary.norg";
          };
      in
      {
        home = {
          inherit shellAliases;
          sessionPath = [ "$HOME/.yarn/bin" ];
          packages = [
            pkgs.fishPlugins.colored-man-pages
            pkgs.fishPlugins.done
            pkgs.fishPlugins.forgit
            pkgs.fishPlugins.pisces
            pkgs.fishPlugins.puffer
            pkgs.fishPlugins.fifc
          ];
        };

        programs = {
          atuin.enable = true;
          atuin.package = pkgs.atuin.overrideAttrs (d: rec {
            version = "18.4.0";
            src = pkgs.fetchFromGitHub {
              owner = "atuinsh";
              repo = "atuin";
              rev = "v${version}";
              hash = "sha256-P/q4XYhpXo9kwiltA0F+rQNSlqI+s8TSi5v5lFJWJ/4=";
            };
            cargoDeps = d.cargoDeps.overrideAttrs (_: {
              name = "atuin-${version}-vendor.tar.gz";
              inherit src;
              outputHash = "sha256-mrsqaqJHMyNi3yFDIyAXFBS+LY71VWXE8O7mjvgI6lo=";
            });
          });
          atuin.enableFishIntegration = config.programs.fish.enable;
          atuin.enableBashIntegration = config.programs.bash.enable;

          nix-index.enableFishIntegration = config.programs.fish.enable;
          nix-index.enableBashIntegration = config.programs.bash.enable;

          zoxide.enable = true;
          zoxide.enableFishIntegration = config.programs.fish.enable;

          dircolors.enable = true;
          dircolors.enableFishIntegration = config.programs.fish.enable;

          thefuck.enable = false;
          thefuck.enableInstantMode = true;
          thefuck.enableFishIntegration = config.programs.fish.enable;
          thefuck.enableBashIntegration = false;

          bash = {
            enable = true;
            enableCompletion = true;
          };

          fish = {
            enable = true;

            functions = {
              ghds = ''
                for repo in $argv
                  gh repo delete $r --yes
                end
              '';
              gitignore = "curl -sL https://www.gitignore.io/api/$argv";
              nd = "nix develop ${nixConfigDirectory}#$argv[1] -c $SHELL";
              rpkgjson = ''
                ${pkgs.nodejs}/bin/node -e "console.log(Object.entries(require('./package.json').$argv[1]).map(([k,v]) => k.concat(\"@\").concat(v)).join(\"\n\") )"
              '';
            };

            interactiveShellInit = ''
              # Fish color
              set -U fish_color_command ${color.raw.base04} --bold
              set -U fish_color_redirection DEB974
              set -U fish_color_operator DEB974
              set -U fish_color_end C071D8 --bold
              set -U fish_color_error ${color.raw.base01} --bold
              set -U fish_color_param ${color.raw.base04}
              set fish_greeting
            '';
          };

          starship = {
            enable = true;
            enableFishIntegration = config.programs.fish.enable;
            enableBashIntegration = config.programs.bash.enable;
            enableTransience = config.programs.fish.enable;
            settings =
              let
                withStartLineBreak = s: " ${s}";
                withEndLineBreak = s: "${s} ";
                defaultProgramFormat = withEndLineBreak "[$symbol($version)]($style)";
              in
              {
                add_newline = true;
                command_timeout = 1000;

                cmd_duration = {
                  format = withStartLineBreak "[$duration]($style)";
                  style = "bold ${color.scheme.base01}";
                  show_notifications = true;
                };

                battery = {
                  full_symbol = "🔋 ";
                  charging_symbol = "⚡️ ";
                  discharging_symbol = "💀 ";
                };

                bun.format = defaultProgramFormat;
                git_branch.format = withEndLineBreak "[$symbol$branch]($style)";
                git_status.format = withEndLineBreak "([$all_status$ahead_behind]($style))";
                gcloud.format = withEndLineBreak "[$symbol$active]($style)";
                golang.format = defaultProgramFormat;
                nix_shell.symbol = "❄️";
                nix_shell.format = withEndLineBreak "[$symbol$state]($style)";
                nix_shell.impure_msg = "󰊰";
                nix_shell.pure_msg = "󱨧";
                nodejs.format = defaultProgramFormat;
                ocaml.format = withEndLineBreak "[$symbol($version)(\($switch_indicator$switch_name\))]($style)";
                package.format = withEndLineBreak "[$symbol$version]($style)";
                rust.format = defaultProgramFormat;
                zig.format = defaultProgramFormat;
              };
          };
        };
      };
  };
}
