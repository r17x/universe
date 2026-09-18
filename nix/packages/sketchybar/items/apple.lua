local colors = require("colors")
local icons = require("icons")
local style = require("style")

-- Padding item required because of bracket
sbar.add("item", { width = 5 })

local apple = sbar.add("item", {
	icon = {
		font = { size = 16.0 },
		string = icons.nix,
		padding_right = 8,
		padding_left = 8,
	},
	label = { drawing = false },
	background = {
		color = colors[style.color_keys.item_bg],
		border_color = colors[style.color_keys.item_border],
		border_width = style.background.border_width,
	},
	padding_left = 1,
	padding_right = 1,
	click_script = "sbar_menus -s 0",
})

sbar.add("bracket", { apple.name }, {
	background = {
		color = colors.transparent,
		height = style.background.height + 2,
		border_color = colors[style.color_keys.bracket_border],
	},
})

-- Padding item required because of bracket
sbar.add("item", { width = 7 })
