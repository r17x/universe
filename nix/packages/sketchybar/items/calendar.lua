local settings = require("settings")
local colors = require("colors")
local style = require("style")

-- Padding item required because of bracket
sbar.add("item", { position = "center", width = settings.group_paddings })

local cal = sbar.add("item", {
	icon = {
		color = colors[style.color_keys.icon],
		padding_left = 8,
		font = {
			style = settings.font.style_map["Black"],
			size = 12.0,
		},
	},
	label = {
		color = colors[style.color_keys.label],
		padding_right = 8,
		width = 49,
		align = "right",
		font = { family = settings.font.numbers },
	},
	position = "center",
	update_freq = 30,
	padding_left = 1,
	padding_right = 1,
	background = {
		color = colors[style.color_keys.item_bg],
		border_color = colors[style.color_keys.item_border],
		border_width = style.background.border_width,
	},
})

sbar.add("bracket", { cal.name }, {
	background = {
		color = colors.transparent,
		height = style.background.height + 2,
		border_color = colors[style.color_keys.bracket_border],
	},
})

-- Padding item required because of bracket
sbar.add("item", { position = "center", width = settings.group_paddings })

cal:subscribe({ "forced", "routine", "system_woke" }, function(env)
	cal:set({ icon = os.date("%a. %d %b."), label = os.date("%H:%M") })
end)
