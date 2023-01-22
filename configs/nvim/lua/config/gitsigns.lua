local opts = {
	current_line_blame = false, -- Toggle with `:Gitsigns toggle_current_line_blame`
	current_line_blame_opts = {
		virt_text = true,
		virt_text_pos = "eol", -- 'eol' | 'overlay' | 'right_align'
		delay = 1000,
		ignore_whitespace = false,
	},
	current_line_blame_formatter = "<author>, <author_time:%Y-%m-%d> - <summary>",
	signs = {
		add = { hl = "GitSignsAdd", text = "┃", numhl = "GitSignsAddNr", linehl = "GitSignsAddLn" },
		change = { hl = "GitSignsChange", text = "┃", numhl = "GitSignsChangeNr", linehl = "GitSignsChangeLn" },
		delete = { hl = "GitSignsDelete", text = "", numhl = "GitSignsDeleteNr", linehl = "GitSignsDeleteLn" },
		topdelete = { hl = "GitSignsDelete", text = "‾", numhl = "GitSignsDeleteNr", linehl = "GitSignsDeleteLn" },
		changedelete = { hl = "DiffDelete", text = "~", numhl = "GitSignsChangeNr", linehl = "GitSignsChangeLn" },
	},
	numhl = true,
	linehl = false,
}

require("gitsigns").setup(opts)
