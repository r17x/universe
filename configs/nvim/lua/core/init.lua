local f = require("fun")
local M = {}
-- local api = vim.api

--- neovim/vim common configurations
local set = function(k, v)
	vim.opt[k] = v
end -- same with set tabstop=2
local global = function(k, v)
	vim.g[k] = v
end -- let g:zoom#statustext = 'Z'
local global_only = function(k, v)
	vim.o[k] = v
end -- let g:zoom#statustext = 'Z'
local command = function(cmd)
	vim.cmd(cmd)
end

local indent = 2

M.defaultOptions = {
	-- vim/neovim options
	--- same with vim.opt.[KEY] = value
	--- e.g. `set encoding=utf8`
	encoding = "utf8",
	termguicolors = true,
	backspace = { "indent", "eol", "start" },
	cursorline = false,
	wrap = false,
	number = true,
	relativenumber = true,
	background = "dark",
	tabstop = indent,
	shiftwidth = indent,
	smarttab = true,
	expandtab = true,
	laststatus = 2,
	foldmethod = "expr",
	compatible = false,
	foldexpr = "nvim_treesitter#foldexpr()",
	clipboard = "unnamed",
	mouse = "",
}

function M.cmd(cmds)
	f.each(command, cmds or {})
	return M
end

function M.options(opts)
	f.each(set, opts or M.defaultOptions)
	return M
end

function M.g(opts)
	f.each(global, opts or M.defaultOptions)
	return M
end

function M.o(opts)
	f.each(global_only, opts or M.defaultOptions)
	return M
end

function M.init(opts, callback)
	local opts_ = opts or { with_nix = false }
	-- I'm use nix for generated lazy.nvim plugins configurations
	-- and using while startup neovim
	if opts_.with_nix then
		-- when use r17x/nixpkgs. You will be have lua files
		-- located in $HOME/.config/nvim/lua/gen/lazy.lua
		local ok, lazy_gen = pcall(require, "gen.lazy")
		if not ok then
			vim.notify("Something wrong when load gen.lazy", "info")
		else
			local opts = {
				install = {
					missing = false,
				},
				readme = {
					root = "/Users/r17/.config/nixpkgs/configs/nvim/readme",
					files = { "README.md", "lua/**/README.md" },
					-- only generate markdown helptags for plugins that dont have docs
					skip_if_doc_exists = true,
				},

				ui = {
					-- a number <1 is a percentage., >1 is a fixed size
					size = { width = 0.8, height = 0.8 },
					wrap = true, -- wrap the lines in the ui
					-- The border to use for the UI window. Accepts same border values as |nvim_open_win()|.
					border = "none",
					icons = {
						cmd = "גּ",
						config = "",
						event = "ﳅ",
						ft = " ",
						init = " ",
						import = " ",
						keys = " ",
						lazy = "鈴 ",
						loaded = "●",
						not_loaded = "○",
						plugin = " ",
						runtime = " ",
						source = " ",
						start = "",
						task = "✔ ",
						list = {
							"●",
							"➜",
							"★",
							"‒",
						},
					},
					-- leave nil, to automatically select a browser depending on your OS.
					-- If you want to use a specific browser, you can define it here
					browser = nil, ---@type string?
					throttle = 20, -- how frequently should the ui process render events
					custom_keys = {
						-- you can define custom key maps here.
						-- To disable one of the defaults, set it to false

						-- open lazygit log
						["<leader>l"] = function(plugin)
							require("lazy.util").float_term({ "lazygit", "log" }, {
								cwd = plugin.dir,
							})
						end,

						-- open a terminal for the plugin dir
						["<leader>t"] = function(plugin)
							require("lazy.util").float_term(nil, {
								cwd = plugin.dir,
							})
						end,
					},
				},
			}
			lazy_gen.init(opts)
		end
	end

	M.options()

	pcall(callback or function() end)
end

return M
