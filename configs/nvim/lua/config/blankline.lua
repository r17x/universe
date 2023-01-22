vim.opt.list = true
vim.opt.listchars:append("eol:↴")

require("indent_blankline").setup({
	indentLine_enabled = 1,
	char = "┊",
	filetype_exclude = {
		"help",
		"terminal",
		"dashboard",
		"packer",
		"lspinfo",
		"TelescopePrompt",
		"TelescopeResults",
	},
	buftype_exclude = { "terminal", "neorg" },
	show_trailing_blankline_indent = false,
	show_first_indent_level = false,
	space_char_blankline = "",
	show_current_context = true,
	show_current_context_start = true,
})
