-- local f = require("fun")
-- function M.only(includes)
--   local not_includes = function(name) return not f.index(name, includes) end
--   local keys = function(key) return key end
--   return f.map(keys, f.remove_if(not_includes, M.servers))
-- end

local on_attach = require("config.lsp.attach")
local capabilities = require("config.lsp.capabilities")

require("lazy-lsp").setup({
	-- By default all available servers are set up. Exclude unwanted or misbehaving servers.
	excluded_servers = {
		"diagnosticls",
		"efm",
		"nil_ls",
		"denols",
		"flow",
		"quick_lint_js",
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
