{ lib, pkgs, ... }:

{
  home.packages = [ pkgs.git-filter-repo ];
  home.shellAliases.ghd = "gh-dash";

  programs = {
    jujutsu = {
      enable = true;
      settings = {
        # Default user for jujutsu (no signingKey needed)
        user = {
          name = "r17x";
          email = "ri7nz@evilfactory.id";
        };
      };
    };

    ### git tools
    ## github cli
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
        # need to install vim-conflicted
        res = "!nvim +Conflicted";
        # use for resolve conflicted
        # accept-ours
        aco = "!f() { git checkout --ours -- \"\${@:-.}\"; git add -u \"\${@:-.}\"; }; f";
        # accept-theirs
        ace = "!f() { git checkout --theirs -- \"\${@:-.}\"; git add -u \"\${@:-.}\"; }; f";
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
        url = {
          "git@gitlab.com:" = {
            insteadOf = "https://gitlab.com/";
          };
          "git@bitbucket.org:" = {
            insteadOf = "https://bitbucket.org/";
          };
        };
        # Include dynamically generated identity configs
        include.path = "~/.config/git/identities.gitconfig";
      };
    };
  };
}
