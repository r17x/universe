local colors = require("colors")
local style = require("style")

return function(name)
	return style.monochrome and colors.grey or colors[name]
end
