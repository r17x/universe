{ ... }:
{
  den.aspects.git =
    { user, ... }:
    {
      homeManager =
        { lib, pkgs, ... }:
        {
          home.packages = [ pkgs.git-filter-repo ];
          home.shellAliases.ghd = "gh-dash";

          programs = {
            gh = {
              enable = true;
              settings.git_protocol = "ssh";
              settings.aliases = {
                co = "pr checkout";
                pv = "pr view";
              };
            };

            gh-dash.enable = true;

            git = {
              enable = true;

              aliases = {
                a = "add";
                c = "clone";
                cfd = "clean -fd";
                ca = "commit --amend";
                can = "commit --amend --no-edit";
                r = "rebase";
                ro = "rebase origin/master";
                rc = "rebase --continue";
                ra = "rebase --abort";
                ri = "rebase -i";
                res = "!nvim +Conflicted";
                aco = ''!f() { git checkout --ours -- "''${@:-.}"; git add -u "''${@:-.}"; }; f'';
                ace = ''!f() { git checkout --theirs -- "''${@:-.}"; git add -u "''${@:-.}"; }; f'';
                branches = "branch --sort=-committerdate --format='%(HEAD)%(color:yellow) %(refname:short) | %(color:bold red)%(committername) | %(color:bold green)%(committerdate:relative) | %(color:blue)%(subject)%(color:reset)' --color=always";
                bs = "branches";
                fa = "fetch --all";
              };

              extraConfig = {
                gpg.program = "gpg";
                rerere.enable = true;
                commit.gpgSign = true;
                pull.ff = "only";
                diff.tool = "vimdiff";
                difftool.prompt = false;
                merge.tool = "vimdiff";
                url = lib.mapAttrs (_: insteadOf: { inherit insteadOf; }) user.git.urlRewrites;
                include.path = "~/.config/git/identities.gitconfig";
              };
            };
          };
        };
    };
}
