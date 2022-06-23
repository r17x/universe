local fn = vim.fn
local M = {}

local indent = 2

M.options = {
  encoding = "utf8",
  termguicolors = true,
  backspace = { "indent", "eol", "start" },
  cursorline = false,
  wrap = false,
  number = true,
  relativenumber = true,
  background = 'dark',
  tabstop = indent,
  shiftwidth = indent,
  smarttab = true,
  expandtab = true,
  laststatus = 2,
  foldmethod = 'syntax',
  compatible = false,
}

M.g_options = {
  -- theme
  elite_mode = 1,
  edge_style = 'neon',
  -- markdown preview
  mkdp_browser = 'chrome',
}

M.cmd_options = {
  "filetype plugin on",
  "syntax on",
  "silent! colorscheme edge",
  "nnoremap <SPACE> <Nop>",
  "let mapleader = ' '"
}

M.fun = {
  inject_metadata = function()
    vim.cmd("NeorgStart silent=true")
    vim.cmd("Neorg inject-metadata")

  end,
  create_task = function()
    vim.cmd("NeorgStart silent=true")
    vim.cmd("Neorg gtd capture")
  end,
  search_tasks = function()
    vim.cmd("NeorgStart silent=true")
    vim.cmd("Telescope neorg find_project_tasks")
  end
}

M.mappings = {
  vmap = {
    -- Copy & paste to system clipboard with {<Space> + p} and {<Space> + y}
    ['<Leader>y'] = '"+y',
    ['<Leader>d'] = '"+d',
    ['<Leader>p'] = '"+p',
    ['<Leader>P'] = '"+P',
  },

  nnoremap = {
    -- go back to daashboard
    ["<Leader>gb"] = "<cmd>Dashboard<cr>",
    -- telescope mappings
    ["<Leader>ff"] = "<cmd>lua require('telescope.builtin').find_files()<cr>",
    ["<Leader>fw"] = "<cmd>lua require('telescope.builtin').live_grep()<cr>",
    ["<Leader>fb"] = "<cmd>lua require('telescope.builtin').buffers()<cr>",
    ["<Leader>fh"] = "<cmd>lua require('telescope.builtin').help_tags()<cr>",
    -- markdown preview
    ["<Leader>md"] = "<cmd>MarkdownPreviewToggle<cr>",
    -- open settings nvim
    ["<Leader>om"] = "<cmd>vnew ~/.config/nvim/lua/settings.lua<cr>",
    -- search task
    ["<Leader>ft"] = "<cmd>lua require('settings').fun.search_tasks()<cr>",
    -- create task
    ["<Leader>c"] = "<cmd>lua require('settings').fun.create_task()<cr>",
    -- inject metadata in norg files
    ["<Leader>i"] = "<cmd>lua require('settings').fun.inject_metadata()<cr>",
    -- zenmode
    ["<Leader>z"] = "<cmd>ZenMode<cr>",
    -- quit
    ["<Leader>q"] = "<cmd>q<cr>",
    --[[
    -- create new map here
    ["<Leader>?"] = "<cmd>?</cr>",
    ]] --
  },

  nmap = {
    ["<C-n>"] = "<cmd>NvimTreeToggle<cr>",
    -- CTRL+[h,j,k,l] for movement buffer window
    -- Type {Ctrl+h} for navigated to left
    -- Type {Ctrl+j} for navigated to bottom
    -- Type {Ctrl+k} for navigated to up
    -- Type {Ctrl+l} for navigated to right
    ["<C-h>"] = "<C-w>h",
    ["<C-j>"] = "<C-w>j",
    ["<C-k>"] = "<C-w>k",
    ["<C-l>"] = "<C-w>l",

    -- Disable arrow movement, resize splits instead.
    -- <- : for resize(+2) to left
    -- -> : for resize(+2) to righ
    --  V : for resize(+2) to bottom
    --  ^ : for resize(+2) to up
    ["<Up>"]    = "<cmd>resize +2<cr>",
    ["<Down>"]  = "<cmd>resize -2<CR>",
    ["<Left>"]  = "<cmd>vertical resize +2<CR>",
    ["<Right>"] = "<cmd>vertical resize -2<CR>"
  }
}

if fn.exists(":tnoremap") then
  table.insert(
    M.cmd_options,
    [[tnoremap <Esc> <C-\\><C-n>]]
  )
end

return M
