local wk = require("which-key")
local tb = require("telescope.builtin")
local neorg = require("telescope._extensions.neorg")
neorg.journal = function()
	vim.cmd([[Neorg journal]])
end
local gs = require("gitsigns")

local opts = {
	plugins = {
		marks = true, -- shows a list of your marks on ' and `
		registers = true, -- shows your registers on " in NORMAL or <C-r> in INSERT mode
		spelling = {
			enabled = false, -- enabling this will show WhichKey when pressing z= to select spelling suggestions
			suggestions = 20, -- how many suggestions should be shown in the list?
		},
		-- the presets plugin, adds help for a bunch of default keybindings in Neovim
		-- No actual key bindings are created
		presets = {
			operators = true, -- adds help for operators like d, y, ... and registers them for motion / text object completion
			motions = true, -- adds help for motions
			text_objects = true, -- help for text objects triggered after entering an operator
			windows = true, -- default bindings on <c-w>
			nav = true, -- misc bindings to work with windows
			z = true, -- bindings for folds, spelling and others prefixed with z
			g = true, -- bindings for prefixed with g
		},
	},
	-- add operators that will trigger motion and text object completion
	-- to enable all native operators, set the preset / operators plugin above
	operators = { gc = "Comments" },
	key_labels = {
		-- override the label used to display some keys. It doesn't effect WK in any other way.
		-- For example:
		-- ["<space>"] = "SPC",
		-- ["<cr>"] = "RET",
		-- ["<tab>"] = "TAB",
	},
	icons = {
		breadcrumb = "»", -- symbol used in the command line area that shows your active key combo
		separator = "➜", -- symbol used between a key and it's label
		group = "+", -- symbol prepended to a group
	},
	popup_mappings = {
		scroll_down = "<c-d>", -- binding to scroll down inside the popup
		scroll_up = "<c-u>", -- binding to scroll up inside the popup
	},
	window = {
		border = "none", -- none, single, double, shadow
		position = "bottom", -- bottom, top
		margin = { 1, 0, 1, 0 }, -- extra window margin [top, right, bottom, left]
		padding = { 2, 2, 2, 2 }, -- extra window padding [top, right, bottom, left]
		winblend = 0,
	},
	layout = {
		height = { min = 4, max = 25 }, -- min and max height of the columns
		width = { min = 20, max = 50 }, -- min and max width of the columns
		spacing = 3, -- spacing between columns
		align = "left", -- align columns left, center or right
	},
	ignore_missing = false, -- enable this to hide mappings for which you didn't specify a label
	hidden = { "<silent>", "<cmd>", "<Cmd>", "<CR>", "call", "lua", "^:", "^ " }, -- hide mapping boilerplate
	show_help = true, -- show help message on the command line when the popup is visible
	show_keys = true, -- show the currently pressed key and its label as a message in the command line
	triggers = "auto", -- automatically setup triggers
	-- triggers = {"<leader>"} -- or specify a list manually
	triggers_blacklist = {
		-- list of mode / prefixes that should never be hooked by WhichKey
		-- this is mostly relevant for key maps that start with a native binding
		-- most people should not need to change this
		i = { "j", "k" },
		v = { "j", "k" },
	},
	-- disable the WhichKey popup for certain buf types and file types.
	-- Disabled by deafult for Telescope
	disable = {
		buftypes = {},
		filetypes = { "TelescopePrompt" },
	},
}

wk.setup(opts)

wk.register({
	y = {
		y = { '"+y' },
		d = { '"+d' },
		p = { '"+p' },
		P = { '"+P' },
	},

	f = {
		name = "Find...",
		t = {
			function()
				vim.cmd([[Telescope]])
			end,
			"Telescope 🔭",
		},
		j = { neorg.journal, "New Journal ✍️" },
		f = { tb.find_files, "Find file" },
		g = { tb.live_grep, "Find words" },
		b = { tb.buffers, "Find Buffers" },
		h = { tb.help_tags, "Find Help Tags" },
		n = {
			name = "Neorg...",
			w = { neorg.switch_workspace, "Find Workspaces" },
			l = { neorg.insert_link, "Insert Link" },
			f = { neorg.insert_file_link, "Insert File Linke" },
		},
	},

	g = {
		s = {
			name = "Git Signs",
			s = { gs.toggle_signs, "Toggle Sign Column" },
			n = { gs.toggle_numhl, "Toggle Num Hightlight" },
			l = { gs.toggle_linehl, "Toggle Line Hightlight" },
			w = { gs.toggle_word_diff, "Toggle Word Diff" },
			d = { gs.toggle_deleted, "Toggle Deleted" },
			b = { gs.toggle_current_line_blame, "Toggle Current line blame" },
		},
	},

	["<up>"] = {
		function()
			vim.cmd([[resize +2]])
		end,
		"Resize Up",
	},
	["<down>"] = {
		function()
			vim.cmd([[resize -2]])
		end,
		"Resize Down",
	},
	["<left>"] = {
		function()
			vim.cmd([[vertical resize +2]])
		end,
		"Resize Left",
	},
	["<right>"] = {
		function()
			vim.cmd([[vertical resize -2]])
		end,
		"Resize Right",
	},
	["<c-h>"] = { "<c-w>h", "Move top" },
	["<c-j>"] = { "<c-w>j", "Move down" },
	["<c-k>"] = { "<c-w>k", "Move left" },
	["<c-l>"] = { "<c-w>l", "Move right" },
	["<c-n>"] = {
		function()
			vim.cmd([[ NvimTreeToggle ]])
		end,
		"Show Tree side",
	},
}, {
	mode = "n", -- Normal mode
	prefix = "",
	buffer = nil, -- Global mappings. Specify a buffer number for buffer local mappings
	silent = true, -- use `silent` when creating keymaps
	noremap = true, -- use `noremap` when creating keymaps
	nowait = false, -- use `nowait` when creating keymaps
})
