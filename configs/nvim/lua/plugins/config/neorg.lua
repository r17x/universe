return require('neorg').setup {
  logger = { level = "warn" },
  load = {
    ["core.defaults"] = {},
    ["core.gtd.base"] = {
      config = {
        workspace = "me",
        projects = {
          show_completed_projects = true,
          show_projects_without_tasks = true,
        },
      }
    },
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
    ["core.integrations.treesitter"] = {},
    -- ["core.integrations.nvim-cmp"] = {},
    -- ["core.norg.completion"] = {config =  { engine = "nvim-cmp" }},
    ["core.norg.concealer"] = { config = {} },
    ["core.norg.dirman"] = {
      config = {
        workspaces = {
          work = "~/w0/notes", -- Format: <name_of_workspace> = <path_to_workspace_root>
          me = "~/evl/notes",
        },
        autochdir = true, -- Automatically change the directory to the current workspace's root every time
        index = "index.norg", -- The name of the main (root) .norg file
      }
    },
  },
}
