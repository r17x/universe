-- local f = require("fun")
-- function M.only(includes)
--   local not_includes = function(name) return not f.index(name, includes) end
--   local keys = function(key) return key end
--   return f.map(keys, f.remove_if(not_includes, M.servers))
-- end

local on_attach = require("config.lsp.attach")
local capabilities = require("config.lsp.capabilities")

local get_settings_to_configs = function()
	-- TODO make more magically
	return {
		jsonls = {
			settings = require("config.lsp.settings.lsp.jsonls"),
		},
		lua_ls = {
			settings = require("config.lsp.settings.lsp.lua_ls"),
		},
	}
end

local function lspSymbol(name, icon)
	local hl = "DiagnosticSign" .. name
	vim.fn.sign_define(hl, { text = icon, numhl = hl, texthl = hl })
end

lspSymbol("Error", "")
lspSymbol("Info", "")
lspSymbol("Hint", "")
lspSymbol("Warn", "")

vim.lsp.handlers["textDocument/hover"] = vim.lsp.with(vim.lsp.handlers.hover, {
	border = "rounded",
})

require("lazy-lsp").setup({
	-- By default all available servers are set up. Exclude unwanted or misbehaving servers.
	excluded_servers = {
		"diagnosticls",
		"efm",
		-- "nil_ls",
		-- "rnix",
		"denols",
		"flow",
		"quick_lint_js",
		"rls",
	},
	-- Default config passed to all servers to specify on_attach callback and other options.
	default_config = {
		flags = { debounce_text_changes = 150 },
		on_attach = on_attach,
		capabilities = capabilities,
	},

	configs = get_settings_to_configs(),
})
