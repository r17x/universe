local pickers = require'telescope.pickers'
local finders = require'telescope.finders'
local conf = require("telescope.config").values
local context_manager = require "plenary.context_manager"
local make_entry = require "telescope.make_entry"
local with = context_manager.with
local open = context_manager.open
local flatten = vim.tbl_flatten
local entry_display = require "telescope.pickers.entry_display"
local previewers = require "telescope.previewers"
local utils = require "telescope.utils"
local Job = require'plenary.job'

local state = {
  prompt = "",
  results = {},
}

local search = function(opts)
  local entry_maker = function (entry)
    local displayer = entry_display.create {
      separator = " ",
      items = {
        { remaining = true },
      },
    }

    local make_display = function(entry_)
      local display_items = {}

      if entry_.value.__typename == "FileMatch" then
        display_items = { entry_.value.file.url }
      end

      if entry_.value.__typename == "Repository" then
        display_items = { entry_.value.url }
      end

      if entry_.value.__typename == "CommitSearchResult" then
        display_items = { entry_.value.url}
      end

      return displayer(display_items)
    end

    return {
      value = entry,
      name = entry.__typename,
      display = make_display,
      ordinal = entry.__typename,
    }
  end

  local handleChange = function (prompt)
    local cmd = vim.tbl_flatten { "src", "search", "-json", prompt }
    local cmd_result = utils.get_os_command_output(cmd)
    local result_json = vim.fn.json_encode(cmd_result)

    if result_json.ResultCount > 0 then
      print(vim.inspect(result_json.Results))
      state.results = result_json.Results
    end

    local updated_finder = finders.new_table {
      results = state.results,
      entry_maker = entry_maker,
    }

    return { prompt = prompt, updated_finder = updated_finder }
  end

  pickers.new(opts, {
    prompt_title = "query: sourcegraph",
    finder = finders.new_table {
      results = state.results,
      entry_maker = entry_maker,
    },
    on_input_filter_cb = handleChange,
  }):find()
end

return require'telescope'.register_extension{
  exports = {
    search = search,
  },
}
