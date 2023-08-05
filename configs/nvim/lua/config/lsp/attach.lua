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

-- local ih = require("inlay-hints")
local ih = require("lsp-inlayhints")

return function(client, bufnr)
	ih.on_attach(client, bufnr, false)
	signature_on_attach(bufnr)

	local function buf_set_option(...)
		vim.api.nvim_buf_set_option(bufnr, ...)
	end

	buf_set_option("omnifunc", "v:lua.vim.lsp.omnifunc")
	require("which-key").register({
		F = {
			function()
				vim.lsp.buf.format({ async = true })
			end,
			"Format current file",
		},
		K = { vim.lsp.buf.hover, "Hover text" },
		g = {
			D = { vim.lsp.buf.declaration, "Go to declaration" },
			d = { vim.lsp.buf.definition, "Go to definitions" },
			i = { vim.lsp.buf.implementation, "Go to implementations" },
			r = { vim.lsp.buf.references, "Go to references" },
			k = { vim.lsp.buf.signature_help, "Open signature helps" },
		},
		["[d"] = { vim.lsp.diagnostic.goto_prev, "Previous diagnostic" },
		["]d"] = { vim.lsp.diagnostic.goto_next, "Next diagnostic" },
		["rn"] = { vim.lsp.buf.rename, "Rename declaration" },
	}, {
		mode = "n",
		prefix = "",
		buffer = bufnr,
		silent = true,
		noremap = true,
		nowait = true,
	})
	-- autoformat on save
	if client.server_capabilities.documentFormattingProvider then
		vim.cmd([[autocmd BufWritePre <buffer> lua vim.lsp.buf.format()]])
	end
end
