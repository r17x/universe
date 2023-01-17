local M = {}
-- local api = vim.api

--- neovim/vim common configurations
local set = vim.opt -- same with set tabstop=2
local global = vim.g -- let g:zoom#statustext = 'Z'

local indent = 2

M.defaultOptions = {
	--- vim/neovim options
	-- vim.opt.[KEY] = value
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
}

function M.cmd(cmds)
	for _, cmd in pairs(cmds) do
		vim.cmd(cmd)
	end
	return M
end

function M.options(opts)
	local opts_ = opts or M.defaultOptions
	for key, value in pairs(opts_) do
		set[key] = value
	end
	return M
end

function M.global(opts)
	local opts_ = opts or M.defaultGlobal
	for key, value in pairs(opts_) do
		global[key] = value
	end
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
			lazy_gen.init()
		end
	end
	M.options()
	pcall(callback or function() end)
end

return M
