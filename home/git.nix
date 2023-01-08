{ ... }:

let
  work = {
    name = "R Adysurya Agus";
    email = "adysurya@ruangguru.com";
    signingKey = "F7B293AE6EAB33EE";
  };
  evil = {
    name = "r17x";
    email = "ri7nz@evilfactory.id";
    signingKey = "5CA1E57AFBF76F90";
  };
  w1 = {
    name = "r17x";
    email = "ri7nz@evilfactory.id";
    signingKey = "5CA1E57AFBF76F90";
  };
in
{
  programs.git.enable = true;

  programs.git.aliases = {
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

  programs.git.extraConfig = {
    gpg.program = "gpg";
    rerere.enable = true;
    commit.gpgSign = true;
    pull.ff = "only";
    diff.tool = "vimdiff";
    difftool.prompt = false;
    merge.tool = "vimdiff";
    url = {
      "git@gitlab.com" = {
        insteadOf = "https://gitlab.com";
      };
    };
  };

  programs.git.includes = [
    {
      condition = "gitdir:~/w0/";
      contents.user = work;
    }

    {
      condition = "gitdir:~/w1/";
      contents.user = w1;
    }

    {
      condition = "gitdir:~/go/";
      contents.user = work;
    }

    {
      condition = "gitdir:~/evl/";
      contents.user = evil;
    }

    {
      condition = "gitdir:~/.local/share/";
      contents.user = evil;
    }

    {
      condition = "gitdir:~/.config/nixpkgs/";
      contents.user = evil;
    }
  ];


  ### git tools
  ## github cli
  programs.gh.enable = true;
  programs.gh.settings.git_protocol = "ssh";
  programs.gh.settings.aliases = {
    co = "pr checkout";
    pv = "pr view";
  };
}
