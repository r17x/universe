-- Requirements
--- https://luafun.github.io/ (*)
--- https://nixos.org/ (?)

require("core")
	-- .options({ [KEY] = <VALUE> }) -- will set vim.opt[KEY]
	-- will set vim.g[KEY]-
	.g({
		elite_mode = 1,
		edge_style = "neon", -- https://github.com/sainnhe/edge/blob/master/doc/edge.txt#L198
		-- edge_better_performance = 1, -- https://github.com/sainnhe/edge/blob/master/doc/edge.txt#L416
		-- when use nix edge_better_performance it's fail to configured, because /nix/store cannot to write
		mapleader = " ",
	})
	-- same with vim.o
	.o({
		timeout = true,
		timeoutlen = 300,
		completeopt = "menu,menuone,noselect",
	})
	-- same with vim.cmd [[ command ]]
	.cmd({
		"filetype plugin on",
		"syntax on",
		"silent! colorscheme edge",
		"nnoremap <SPACE> <Nop>",
	})
	-- lazy plugin init and callback
	.init({ with_nix = true }, function()
		require("config.dashboard")
		require("config.treesitter")
		require("config.neorg")
		require("config.lsp.servers")
		require("config.lsp.cmp")
		require("config.nvim-tree")
		require("config.keymap")
	end)