require("core")
	-- .options({ [KEY] = <VALUE> }) -- will set vim.opt[KEY]
	-- will set vim.g[KEY]-
	.global({
		elite_mode = 1,
		edge_style = "neon", -- https://github.com/sainnhe/edge/blob/master/doc/edge.txt#L198
		-- edge_better_performance = 1, -- https://github.com/sainnhe/edge/blob/master/doc/edge.txt#L416
		-- when use nix edge_better_performance it's fail to configured, because /nix/store cannot to write
		mapleader = " ",
	})
	-- lazy plugin and callback
	.init({ with_nix = true }, function()
		require("config.dashboard")
		require("config.treesitter")
		require("config.neorg")

		vim.cmd([[colorscheme edge]])

		local on_attach = require("config.lsp.attach")
		local capabilities = require("config.lsp.capabilities")

		require("lazy-lsp").setup({
			-- By default all available servers are set up. Exclude unwanted or misbehaving servers.
			excluded_servers = {
				"ccls",
				"zk",
			},
			-- Default config passed to all servers to specify on_attach callback and other options.
			default_config = {
				flags = {
					debounce_text_changes = 150,
				},
				on_attach = on_attach,
				capabilities = capabilities,
			},
			-- Override config for specific servers that will passed down to lspconfig setup.
			-- configs = {
			--   rnix = {
			--   },
			-- },
		})
	end)
