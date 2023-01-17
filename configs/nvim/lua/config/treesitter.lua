-- local parser_configs = require("nvim-treesitter.parsers").get_parser_configs()

-- These two are optional and provide syntax highlighting
-- for Neorg tables and the @document.meta tag
-- parser_configs.norg_meta = {
--   install_info = {
--     url = "https://github.com/nvim-neorg/tree-sitter-norg-meta",
--     files = { "src/parser.c" },
--     branch = "main"
--   },
-- }
--
-- parser_configs.norg_table = {
--   install_info = {
--     url = "https://github.com/nvim-neorg/tree-sitter-norg-table",
--     files = { "src/parser.c" },
--     branch = "main"
--   },
-- }

-- TODO
--[[ when tree-sitter-rescript have a "parser.c". So, we can enable this line
parser_configs.rescript = {
    install_info = {
        url = "https://github.com/nkrkv/tree-sitter-rescript",
        files = { "src/scanner.c" },
        branch = "main"
    },
}
]]
--

require("nvim-treesitter.install").compilers = { "gcc" }
require("nvim-treesitter.configs").setup({
	ensure_installed = {},
	-- One of "all", "maintained" (parsers with maintainers), or a list of languages
	-- ensure_installed = {
	--   "commonlisp",
	--   "go",
	--   "graphql",
	--   "html",
	--   "javascript",
	--   "json",
	--   "latex",
	--   "lua",
	--   "markdown",
	--   "nix",
	--   "norg",
	--   "ocaml",
	--   "ocaml_interface",
	--   "rust",
	--   "regex",
	--   "tsx",
	--   "typescript",
	--   "yaml",
	-- },
	-- Install languages synchronously (only applied to `ensure_installed`)
	-- parser_install_dir = "/nix/store/c31pwri2flmy87vy5zdp1n9bj377shvj-treesitter-parsers/parser",
	sync_install = false,
	-- List of parsers to ignore installing
	-- ignore_install = { "javascript" },
	-- indent = {
	--   enable = true
	-- },
	highlight = {
		-- `false` will disable the whole extension
		enable = true,
		-- list of language that will be disabled
		-- disable = { "c", "rust" },
		-- Setting this to true will run `:h syntax` and tree-sitter at the same time.
		-- Set this to `true` if you depend on 'syntax' being enabled (like for indentation).
		-- Using this option may slow down your editor, and you may see some duplicate highlights.
		-- Instead of true it can also be a list of languages
		additional_vim_regex_highlighting = false,
	},
})
