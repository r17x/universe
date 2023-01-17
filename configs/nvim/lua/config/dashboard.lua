local dash = require("dashboard")

dash.hide_statusline = true
dash.hide_tabline = true
dash.hide_winbar = true

dash.session_directory = "~/.session_dashboard.nvim"

vim.api.nvim_create_autocmd("User", {
	pattern = "DBSessionSavePre",
	callback = function()
		pcall(vim.cmd, "NvimTreeClose")
	end,
})

-- dash.default_executive = "telescope"

dash.custom_header = {
	-- functional
	---- programming
	----- forever
	"                ░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░                ",
	"            ░░▒▓█▓▒▒▒▒▒▒▓▓██▓▓▓▒▒▒▒▓▓▒░              ",
	"          ░▒▓█▓▒▒▓█▓▓▓▓░░░▒███████▓▓▒▒█▓▒            ",
	"        ░▓██▓▒▒█████████▒░░░█████████▓▒▒██▓          ",
	"      ░▓███▓▒████████████░░░▒██████████▓░▓██▓        ",
	"     ▒████▒▓█████████████▓░░░▓███████████░▓███▒      ",
	"    ▒████▓▒███████████████░░░░████████████░████▒     ",
	"   ▒█████░███████████████▓░░░░▒███████████▒▒████▒    ",
	"  ░█████▓▒███████████████▒▓▓░░░▒██████████▓░█████░   ",
	" ░██████▓▒██████████████▒▓███░░░▓██████████░██████░  ",
	" ░██████▓░█████████████░▓████▓░░░▓████████▓░██████░  ",
	" ▒███████░▓███████████░▓██████▒░░░████████▒▓██████▒  ",
	" ▒███████▒▒█████████▓░▒████████░░░░██████▓▒███████▓  ",
	" ▒███████▒▒▒███████▓░▒██████████░░░░████▓░████████▒  ",
	" ░███████▓░▒▓█████▓░░███████████▓░░░░██▒░█████████░  ",
	" ░▓██████▓▒░░▒▒▓█▓░░█████████████▒░░▒▒░▒▓█████████░  ",
	"  ░███████▒▒░░░░░▒▓███████████████▒░░░▒▒█████████░   ",
	"  ░▒██████▒▒░░░▒▒▒▒▒▒▒▒▒▓█▓▓▓▓▓▓▒▒▒░░░▓▒████████▒    ",
	"   ░▒██████████████████▓░░░░███████████████████▒     ",
	"     ░████████▓▓▓▓░░░░░░▒░░░░░░░░░░▓▓▓████████░      ",
	"      ░▒████████▓▓▒░░░░░█▒▓░░░░░░░▒▓▓███████▒        ",
	"        ░▒█████████▓▒▒░░▓▒▓░░░▒▓██████████▒          ",
	"           ░▓███████▒▓▒▒░░░░░▒▓████████▓▒            ",
	"              ░▒▓████▓▓▒▒▓░▓▒▒█████▓▒░               ",
	"                      ▒▒▒▓▓▓▒▒                       ",
	"                                                     ",
}

dash.custom_center = {
	-- { icon = ' ', desc = "Open Calendar             SPC g c", action = "Calendar" },
	-- { icon = '☑ ', desc = "Find Project Task         SPC f t", action = "lua require('settings').fun.search_tasks()" },
	{ icon = " ", desc = "Taking Notes (Norg)       SPC n n", action = "Telescope neorg switch_workspace" },
	{ icon = " ", desc = "Find File                 SPC f f", action = "Telescope find_files" },
	{ icon = " ", desc = "Recents                   SPC f o", action = "Telescope oldfiles" },
	{ icon = " ", desc = "Find Word                 SPC f w", action = "Telescope live_grep" },
	{ icon = "洛", desc = "New File                  SPC f n", action = "DashboardNewFile" },
	{ icon = " ", desc = "Bookmarks                 SPC b m", action = "Telescope marks" },
	{ icon = " ", desc = "Load Last Session         SPC l  ", action = "SessionLoad" },
}
