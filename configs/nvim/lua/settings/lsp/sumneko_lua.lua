return {
	Lua = {
		format = {
			enable = true,
		},
		completion = {
			autoRequire = true,
		},
		diagnostics = {
			globals = { "vim" },
		},
		workspaces = {
			library = {
				[vim.fn.expand("$VIMRUNTIME/lua")] = true,
				[vim.fn.expand("$VIMRUNTIME/lua/vim/lsp")] = true,
			},
		},
	},
}
