local function signature_on_attach(bufnr)
	local signature_ok, signature = pcall(require, "lsp_signature")

	if signature_ok then
		local signature_config = {
			bind = true,
			doc_lines = 0,
			floating_window = true,
			fix_pos = true,
			hint_enable = true,
			hint_prefix = " ",
			hint_scheme = "String",
			hi_parameter = "Search",
			max_height = 22,
			max_width = 120, -- max_width of signature floating_window, line will be wrapped if exceed max_width
			handler_opts = {
				border = "rounded", -- double, single, shadow, none
			},
			zindex = 200, -- by default it will be on top of all floating windows, set to 50 send it to bottom
			padding = "", -- character to pad on left and right of signature can be ' ', or '|'  etc
		}

		signature.on_attach(signature_config, bufnr)
	end
end

return function(client, bufnr)
	signature_on_attach(bufnr)

	local function buf_set_option(...)
		vim.api.nvim_buf_set_option(bufnr, ...)
	end

	buf_set_option("omnifunc", "v:lua.vim.lsp.omnifunc")

	-- TODO move to keymaps Mappings
	-- local nnoremap = require('core.utils').nnoremap
	-- nnoremap('ff', function() vim.lsp.buf.format { async = true } end)
	-- nnoremap('gD', vim.lsp.buf.declaration)
	-- nnoremap('gd', vim.lsp.buf.definition)
	-- nnoremap('K', vim.lsp.buf.hover)
	-- nnoremap('gi', vim.lsp.buf.implementation)
	-- nnoremap('gk', vim.lsp.buf.signature_help)
	-- nnoremap('gr', vim.lsp.buf.references)
	-- nnoremap('rn', vim.lsp.buf.rename)
	-- nnoremap('[d', vim.lsp.diagnostic.goto_prev)
	-- nnoremap(']d', vim.lsp.diagnostic.goto_next)

	-- autoformat on save
	if client.server_capabilities.documentFormattingProvider then
		vim.cmd("autocmd BufWritePre <buffer> lua vim.lsp.buf.format()")
	end
end
