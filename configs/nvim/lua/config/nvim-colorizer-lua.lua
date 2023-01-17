require("colorizer").setup({
	buftypes = {
		"*",
		-- exclude prompt and popup buftypes from highlight
		"!prompt",
		"!popup",
	},
	filetypes = {
		"*", -- Highlight all files, but customize some others.
		"!vim", -- Exclude vim from highlighting.
		-- Exclusion Only makes sense if '*' is specified!
	},
})
