_final: prev:

# Useful for testing/using Vim plugins that aren't in `nixpkgs`.
# (final.vimUtils.buildVimPluginsFromFlakeInputs inputs [
#   # Add flake input names here for a Vim plugin repos
# ]) // 
# Other Vim plugins
# how to put packages here?
# 1. add in schema inputs `inputs.repo_flake.url`
# 2. add package name from inputs.repo_flake.packages.${prev.stdenv.system} package_name;
# 3. done
# e.g., `inherit (inputs.cornelis.packages.${prev.stdenv.system}) cornelis-vim;`

# vimPlugins - overlays --------------------------------------------------------{{{
{
  vimPlugins = prev.vimPlugins.extend (_: p:
    let
      nvim-treesitter = (p.nvim-treesitter.overrideAttrs (_: {
        version = "2023-05-04";
        src = prev.fetchFromGitHub {
          owner = "r17x";
          repo = "nvim-treesitter";
          rev = "4762ab19d15c00ae586aa50ba62adc6307b91a28";
          sha256 = "0xk7qk1ds6s0n8kflv6q75rlgrqwd9wzw9sk9dgjbq0yc36p0y69";
        };
      }));
    in
    {
      inherit nvim-treesitter;

      lazy-nvim = prev.vimUtils.buildVimPluginFrom2Nix {
        pname = "lazy.nvim";
        version = "2023-01-15";
        src = prev.fetchFromGitHub {
          owner = "folke";
          repo = "lazy.nvim";
          rev = "984008f7ae17c1a8009d9e2f6dc007e13b90a744";
          sha256 = "19hqm6k9qr5ghi6v6brxr410bwyi01mqnhcq071h8bibdi4f66cg";
        };
        meta.homepage = "https://github.com/folke/lazy.nvim";
      };

      git-conflict-nvim = prev.vimUtils.buildVimPluginFrom2Nix {
        pname = "git-conflict.nvim";
        version = "2022-12-31";
        src = prev.fetchFromGitHub {
          owner = "akinsho";
          repo = "git-conflict.nvim";
          rev = "cbefa7075b67903ca27f6eefdc9c1bf0c4881017";
          sha256 = "1pli57rl2sglmz2ibbnjf5dxrv5a0nxk8kqqkq1b0drc30fk9aqi";
        };
        meta.homepage = "https://github.com/akinsho/git-conflict.nvim";
      };

      codeium-vim = prev.vimUtils.buildVimPluginFrom2Nix {
        pname = "codeium-vim";
        version = "2023-02-08";
        src = prev.fetchFromGitHub {
          owner = "Exafunction";
          repo = "codeium.vim";
          rev = "78382694eb15e1818ec6ff9ccd0389f63661b56f";
          sha256 = "1b4lf0s8x3qqvpmyzz0a7j3ynvlzx8sx621dqbf8l3vl7nfkc4gy";
        };
        meta.homepage = "https://github.com/Exafunction/codeium.vim";
      };

      nvim-treesitter-rescript = prev.vimUtils.buildVimPluginFrom2Nix {
        pname = "nvim-treesitter-rescript";
        version = "2023-03-05";
        src = prev.fetchFromGitHub {
          owner = "nkrkv";
          repo = "nvim-treesitter-rescript";
          rev = "21ce711396b1d836a75781d65f34241f14161f94";
          sha256 = "1bzlc8a9fsbda6dg27g52d9mcwfrpmk1b00bspksvq18d69m6n53";
        };
      };

      vim-rescript = prev.vimUtils.buildVimPluginFrom2Nix {
        pname = "vim-rescript";
        version = "2022-12-23";
        src = prev.fetchFromGitHub {
          owner = "rescript-lang";
          repo = "vim-rescript";
          rev = "8128c04ad69487b449936a6fa73ea6b45338391e";
          sha256 = "0x5lhzlvfyz8aqbi5abn6fj0mr80yvwlwj43n7qc2yha8h3w17kr";
        };
      };
    }
  );
}
