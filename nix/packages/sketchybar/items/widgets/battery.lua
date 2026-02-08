local icons = require("icons")
local colors = require("colors")
local settings = require("settings")

local battery = sbar.add("item", "widgets.battery", {
	position = "right",
	icon = {
		font = {
			style = settings.font.style_map["Regular"],
			size = 19.0,
		},
	},
	label = { font = { family = settings.font.numbers } },
	update_freq = 180,
	popup = { align = "center" },
})

local remaining_time = sbar.add("item", {
	position = "popup." .. battery.name,
	icon = {
		string = "Time remaining:",
		width = 100,
		align = "left",
	},
	label = {
		string = "??:??h",
		width = 100,
		align = "right",
	},
})

battery:subscribe({ "routine", "power_source_change", "system_woke" }, function()
	sbar.exec("ioreg -rc AppleSmartBattery | grep -w CurrentCapacity | head -1", function(cap_info)
		local charge = 0
		local label = "?"
		local cap = cap_info:match("(%d+)%s*$")
		if cap then
			charge = tonumber(cap)
			label = charge .. "%"
		end

		sbar.exec(
			"ioreg -rc AppleSmartBattery | grep -E 'IsCharging|ExternalConnected' | grep -v AppleRaw",
			function(status_info)
				local icon = icons.battery._0
				local color = colors.red

				local charging = status_info:match("IsCharging.- Yes")
				local on_ac = status_info:match("ExternalConnected.- Yes")

				if charging or on_ac then
					icon = icons.battery.charging
					color = colors.green
				elseif charge > 80 then
					icon = icons.battery._100
					color = colors.green
				elseif charge > 60 then
					icon = icons.battery._75
					color = colors.green
				elseif charge > 40 then
					icon = icons.battery._50
					color = colors.green
				elseif charge > 20 then
					icon = icons.battery._25
					color = colors.orange
				end

				battery:set({
					icon = { string = icon, color = color },
					label = { string = (charge < 10 and "0" or "") .. label },
				})
			end
		)
	end)
end)

battery:subscribe("mouse.clicked", function(env)
	local drawing = battery:query().popup.drawing
	battery:set({ popup = { drawing = "toggle" } })

	if drawing == "off" then
		sbar.exec("ioreg -rc AppleSmartBattery | grep -w ExternalConnected | head -1", function(ac_info)
			local on_ac = ac_info:match("Yes")
			sbar.exec("ioreg -rc AppleSmartBattery | grep -w TimeRemaining | head -1", function(batt_info)
				local minutes = batt_info:match("(%d+)%s*$")
				local label = "No estimate"
				if minutes then
					minutes = tonumber(minutes)
					if on_ac and (minutes == 0 or minutes > 1000) then
						label = "Fully charged"
					elseif on_ac then
						label = string.format("%d:%02dh to full", math.floor(minutes / 60), minutes % 60)
					else
						label = string.format("%d:%02dh left", math.floor(minutes / 60), minutes % 60)
					end
				end
				remaining_time:set({ label = label })
			end)
		end)
	end
end)

sbar.add("bracket", "widgets.battery.bracket", { battery.name }, {
	background = { color = colors.bg1 },
})

sbar.add("item", "widgets.battery.padding", {
	position = "right",
	width = settings.group_paddings,
})
