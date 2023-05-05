require("neorg").setup({
	logger = { level = "warn" },
	load = {
		["core.defaults"] = {},
		-- wait for v1 https://github.com/nvim-neorg/neorg/issues/695
		-- ["core.gtd.base"] = {
		--   config = {
		--     workspace = "me",
		--     projects = {
		--       show_completed_projects = true,
		--       show_projects_without_tasks = true,
		--     },
		--   }
		-- },
		["core.presenter"] = {
			config = {
				zen_mode = "zen-mode",
				slide_count = {
					enable = true,
					position = "top",
					count_format = "[%d/%d]",
				},
			},
		},
		["core.keybinds"] = { config = {
			default_keybinds = true,
			neorg_leader = ",",
		} },
		["core.integrations.telescope"] = {},
		-- ["core.norg.completion"] = {
		--   config = {
		--     engine = "nvim-cmp"
		--   }
		-- },
		["core.integrations.treesitter"] = {},
		["core.export"] = {},
		["core.export.markdown"] = {},
		-- ["core.integrations.nvim-cmp"] = {},
		["core.completion"] = { config = { engine = "nvim-cmp" } },
		["core.concealer"] = { config = {} },
		["core.dirman"] = {
			config = {
				workspaces = {
					work = "~/w0/notes", -- Format: <name_of_workspace> = <path_to_workspace_root>
					work1 = "~/w1/notes", -- Format: <name_of_workspace> = <path_to_workspace_root>
					me = "~/evl/rin_rocks/notes",
				},
				autochdir = true, -- Automatically change the directory to the current workspace's root every time
				index = "index.norg", -- The name of the main (root) .norg file
			},
		},
		["core.esupports.metagen"] = {
			config = {
				type = "auto",
			},
		},
	},
})
