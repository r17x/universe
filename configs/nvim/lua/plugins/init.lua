local present, packer = pcall(require, "plugins.manager")

if not present then
  return false
end

local config_load = function(...)
  local req = ""
  for _, conf in ipairs({ ... }) do
    req = ("").format("%s require('%s')", req, conf)
  end
  return req
end

local fly = function(use)
  -- packer nvim
  use { 'wbthomason/packer.nvim' }
  -- codi is interactive REPL
  use { 'metakirby5/codi.vim' }
  -- theme list
  use { 'sainnhe/edge' }

  -- syntax highlight (treesitter)
  use {
    'nvim-treesitter/nvim-treesitter',
    run = ':TSUpdate',
    config = config_load 'plugins.config.treesitter',
    event = "BufRead"
  }

  use {
    "reasonml-editor/vim-reason-plus",
    ft = { "reason" }
  }

  use {
    'nkrkv/nvim-treesitter-rescript',
    run = ':TSInstall rescript',
    after = "nvim-treesitter"
  }

  use {
    'kyazdani42/nvim-web-devicons',
    event = "BufRead"
  }

  -- tree (like sidebar navigation for tree files)
  use {
    'kyazdani42/nvim-tree.lua',
    requires = {
      'kyazdani42/nvim-web-devicons', -- optional, for file icon
    },
    config = config_load 'plugins.config.nvim-tree',
    cmd = {
      "NvimTreeRefresh",
      "NvimTreeToggle"
    }
  }

  use {
    'tpope/vim-dispatch',
    opt = true,
    cmd = { 'Dispatch', 'Make', 'Focus', 'Start' }
  }

  use {
    'nvim-lualine/lualine.nvim',
    after = "nvim-web-devicons",
    requires = { 'kyazdani42/nvim-web-devicons' },
    config = config_load 'plugins.config.lualine',
    event = 'BufRead'
  }
  -- finder
  use {
    'nvim-telescope/telescope.nvim',
    requires = {
      'nvim-lua/popup.nvim',
      'nvim-lua/plenary.nvim',
      "nvim-telescope/telescope-github.nvim",
    },
    module = 'telescope',
    event = "VimEnter",
    config = function()
      require 'telescope'.load_extension 'src'
      require 'telescope'.load_extension 'gh'
    end
  }
  -- nvim-debugger
  use { 'mfussenegger/nvim-dap', after = "nvim-lspconfig" }

  use { 'Pocco81/dap-buddy.nvim', after = "nvim-lspconfig" }

  -- lsp
  use {
    'williamboman/nvim-lsp-installer',
    run = ":LspInstall sumneko_lua rescriptls tsserver eslint",
    config = config_load("lspconfig", "plugins.config.lsp"),
    event = "BufRead"
  }

  use {
    'neovim/nvim-lspconfig',
    module = "lspconfig"
  }

  use {
    "ray-x/lsp_signature.nvim",
    after = "nvim-lspconfig",
    config = config_load 'plugins.config.lsp.signature'
  }


  -- LSP Completion
  use {
    'rafamadriz/friendly-snippets',
    event = "InsertEnter",
  }

  use {
    'hrsh7th/nvim-cmp',
    after = "friendly-snippets",
    ft = "norg",
    config = config_load 'plugins.config.lsp.cmp'
  }

  use {
    'hrsh7th/cmp-nvim-lsp', -- LSP source for nvim-cmp
  }

  use {
    'saadparwaiz1/cmp_luasnip', -- Snippets source for nvim-cmp
    after = 'nvim-cmp'
  }

  use {
    'hrsh7th/cmp-buffer',
    after = 'nvim-cmp'
  }

  use {
    'hrsh7th/cmp-cmdline',
    after = 'nvim-cmp'
  }

  use {
    'hrsh7th/cmp-path',
    after = 'nvim-cmp'
  }

  use {
    'L3MON4D3/LuaSnip', -- Snippets plugin
    after = 'nvim-cmp',
    wants = "friendly-snippets"
  }

  use {
    "windwp/nvim-autopairs",
    event = "VimEnter",
    config = config_load "plugins.config.autopairs"
  }

  --- git integrations
  use {
    "lewis6991/gitsigns.nvim",
    config = config_load 'plugins.config.gitsigns'
  }

  use {
    "lambdalisue/gina.vim",
    cmd = { "Gina" }
  }

  -- use { 'vimwiki/vimwiki', event = "VimEnter"}

  -- use {
  --   'jeffmm/vim-roam',
  --   cmd = {
  --     "RoamSearchText",
  --     "RoamSearchFiles",
  --     "RoamSearchTags",
  --     "RoamInbox",
  --     "RoamNewNote"
  --   }
  -- }

  -- use {
  --   'junegunn/fzf',
  --   after = "vim-roam"
  -- }

  -- use { 'junegunn/fzf.vim', after = "vim-roam"}

  --- WRITING
  -- markdown toc
  use {
    "folke/zen-mode.nvim",
    config = function()
      require("zen-mode").setup {}
    end
  }

  use {
    'mzlogin/vim-markdown-toc',
    cmd = {
      'GenTocGFM'
    }
  }

  use {
    'iamcco/markdown-preview.nvim',
    ft = { "markdown", "vimwiki" },
    run = function() vim.fn['mkdp#util#install']() end
    -- setup = config_load 'plugins.setup.mkdp'
  }

  --- MISC

  use {
    "nathom/filetype.nvim",
    setup = config_load 'plugins.setup.filetype',
    config = config_load 'plugins.config.filetype',
  }

  use {
    "glepnir/dashboard-nvim",
    setup = config_load 'plugins.setup.dashboard'
  }

  use {
    'wakatime/vim-wakatime',
    event = "BufRead"
  }

  use {
    'lukas-reineke/indent-blankline.nvim',
    event = "BufRead",
    config = config_load 'plugins.config.blankline'
  }

  use {
    'kristijanhusak/vim-carbon-now-sh',
    cmd = { "CarbonNowSh" },
    setup = function() require 'utils'.apply_mappings({ xnoremap = { ["<Leader>cc"] = "<cmd>CarbonNowSh<cr>" } }) end
  }

  use {
    "nvim-neorg/neorg",
    -- tag = "latest",
    -- ft = "norg",
    after = "dashboard-nvim",
    config = config_load 'plugins.config.neorg',
    requires = {
      "nvim-neorg/neorg-telescope",
      "nvim-lua/plenary.nvim"
    }
  }

  use {
    "itchyny/calendar.vim",
    config = function()
      vim.cmd("source ~/.whoami/credentials.vim")
      vim.g.calendar_google_calendar = 1
      vim.g.calendar_google_task = 1
    end
  }

  -- misc
  use {
    'jamessan/vim-gnupg',
  }
end

return packer.startup(fly)
