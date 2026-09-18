local colors = require("colors")
local style = require("style")

-- Equivalent to the --bar domain
sbar.bar({
	topmost = "window",
	height = style.bar.height,
	color = colors.bar.bg,
	padding_right = style.bar.padding,
	padding_left = style.bar.padding,
})
