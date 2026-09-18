local settings = require("settings")
local colors = require("colors")
local style = require("style")

-- Equivalent to the --default domain
sbar.default({
	updates = "when_shown",
	icon = {
		font = {
			family = settings.font.text,
			style = settings.font.style_map[style.font.icon.style],
			size = style.font.icon.size,
		},
		color = colors[style.color_keys.icon],
		padding_left = settings.paddings,
		padding_right = settings.paddings,
		background = { image = { corner_radius = style.background.corner_radius } },
	},
	label = {
		font = {
			family = settings.font[style.font.label.family],
			style = settings.font.style_map[style.font.label.style],
			size = style.font.label.size,
		},
		color = colors[style.color_keys.label],
		padding_left = settings.paddings,
		padding_right = settings.paddings,
	},
	background = {
		height = style.background.height,
		corner_radius = style.background.corner_radius,
		border_width = style.background.border_width,
		border_color = colors[style.color_keys.bg_border],
		image = {
			corner_radius = style.background.corner_radius,
			border_color = colors.grey,
			border_width = 1,
		},
	},
	popup = {
		background = {
			border_width = style.popup.border_width,
			corner_radius = style.popup.corner_radius,
			border_color = colors.popup.border,
			color = colors.popup.bg,
			shadow = { drawing = true },
		},
		blur_radius = 50,
	},
	padding_left = 5,
	padding_right = 5,
	scroll_texts = true,
})
