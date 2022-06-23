-- options must be applied before `nvim-tree`.setup
return require 'nvim-tree'.setup {
  view = {
    side = "left",
    width = 25,
  },
  renderer = {
    highlight_git = true,
    indent_markers = {
      enable = true,
    },
    icons = {
      show = {
        git = true,
        folder = true,
        file = true,
      },
      glyphs = {
        git = {
          unstaged = "✗",
          staged = "✓",
          unmerged = "x",
          renamed = "➜",
          untracked = "★"
        },
      }
    },

  },
  auto_reload_on_write = true,
  disable_netrw = true,
  filters = {
    dotfiles = false,
    ignore = { '__pycache__', '.git', 'node_modules', '.cache' }
  }
}
