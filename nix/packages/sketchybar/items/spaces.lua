local colors = require("colors")
local icons = require("icons")
local settings = require("settings")
local app_icons = require("helpers.app_icons")

local spaces = {}
local space_brackets = {}
local space_paddings = {}

local function build_icon_line(apps)
	if not apps or not next(apps) then
		return " —"
	end
	local parts = {}
	for _, app in ipairs(apps) do
		table.insert(parts, app_icons[app] or app_icons["default"])
	end
	return " " .. table.concat(parts, " ")
end

local function set_space_highlight(i, focused)
	spaces[i]:set({
		icon = { highlight = focused },
		label = { highlight = focused },
		background = { border_color = focused and colors.black or colors.bg2 },
	})
	space_brackets[i]:set({
		background = { border_color = focused and colors.grey or colors.bg2 },
	})
end

for i = 1, 10 do
	local space_type = is_aerospace and "item" or "space"
	local space_config = {
		space = not is_aerospace and i or nil,
		icon = {
			font = { family = settings.font.numbers },
			string = i,
			padding_left = 15,
			padding_right = 8,
			color = colors.white,
			highlight_color = colors.red,
		},
		label = {
			padding_right = 20,
			color = colors.grey,
			highlight_color = colors.white,
			font = "sketchybar-app-font:Regular:16.0",
			y_offset = -1,
		},
		padding_right = 1,
		padding_left = 1,
		background = {
			color = colors.bg1,
			border_width = 1,
			height = 26,
			border_color = colors.black,
		},
		popup = { background = { border_width = 5, border_color = colors.black } },
	}

	local space = sbar.add(space_type, "space." .. i, space_config)
	spaces[i] = space

	space_brackets[i] = sbar.add("bracket", { space.name }, {
		background = {
			color = colors.transparent,
			border_color = colors.bg2,
			height = 28,
			border_width = 2,
		},
	})

	local padding_config = { script = "", width = settings.group_paddings }
	if not is_aerospace then
		padding_config.space = i
	end
	space_paddings[i] = sbar.add(space_type, "space.padding." .. i, padding_config)

	local space_popup = sbar.add("item", {
		position = "popup." .. space.name,
		padding_left = 5,
		padding_right = 0,
		background = {
			drawing = true,
			image = {
				corner_radius = 9,
				scale = 0.2,
			},
		},
	})

	if is_aerospace then
		space:subscribe("mouse.clicked", function(_)
			sbar.exec("aerospace workspace " .. i)
		end)
	else
		space:subscribe("space_change", function(env)
			set_space_highlight(i, env.SELECTED == "true")
		end)

		space:subscribe("mouse.clicked", function(env)
			if env.BUTTON == "other" then
				space_popup:set({ background = { image = "space." .. env.SID } })
				space:set({ popup = { drawing = "toggle" } })
			else
				local op = (env.BUTTON == "right") and "--destroy" or "--focus"
				sbar.exec("yabai -m space " .. op .. " " .. env.SID)
			end
		end)
	end

	space:subscribe("mouse.exited", function(_)
		space:set({ popup = { drawing = false } })
	end)
end

if is_aerospace then
	local function update_aerospace(env)
		local focused = env and tonumber(env.FOCUSED_WORKSPACE) or nil

		sbar.exec("aerospace list-windows --all --format '%{app-name}|%{workspace}'", function(result)
			local workspace_apps = {}
			for line in result:gmatch("[^\r\n]+") do
				local app, ws = line:match("(.+)|(.+)")
				if app and ws then
					local ws_num = tonumber(ws)
					if ws_num then
						if not workspace_apps[ws_num] then
							workspace_apps[ws_num] = {}
						end
						table.insert(workspace_apps[ws_num], app)
					end
				end
			end

			sbar.begin_config()
			for ws = 1, 10 do
				local has_windows = workspace_apps[ws] ~= nil
				local is_focused = ws == focused
				local visible = has_windows or is_focused

				spaces[ws]:set({ drawing = visible, label = build_icon_line(workspace_apps[ws]) })
				space_brackets[ws]:set({ drawing = visible })
				space_paddings[ws]:set({ drawing = visible })

				if focused then
					set_space_highlight(ws, is_focused)
				end
			end
			sbar.end_config()
		end)
	end

	local window_observer = sbar.add("item", { drawing = false, updates = true })
	window_observer:subscribe("aerospace_workspace_change", update_aerospace)

	update_aerospace()
else
	local space_window_observer = sbar.add("item", {
		drawing = false,
		updates = true,
	})

	space_window_observer:subscribe("space_windows_change", function(env)
		local apps = {}
		for app, _ in pairs(env.INFO.apps) do
			table.insert(apps, app)
		end
		spaces[env.INFO.space]:set({ label = build_icon_line(apps) })
	end)
end

local spaces_indicator = sbar.add("item", {
	padding_left = -3,
	padding_right = 0,
	icon = {
		padding_left = 8,
		padding_right = 9,
		color = colors.grey,
		string = icons.switch.on,
	},
	label = {
		width = 0,
		padding_left = 0,
		padding_right = 8,
		string = "Spaces",
		color = colors.bg1,
	},
	background = {
		color = colors.with_alpha(colors.grey, 0.0),
		border_color = colors.with_alpha(colors.bg1, 0.0),
	},
})

spaces_indicator:subscribe("swap_menus_and_spaces", function(_)
	local currently_on = spaces_indicator:query().icon.value == icons.switch.on
	spaces_indicator:set({
		icon = currently_on and icons.switch.off or icons.switch.on,
	})
end)

spaces_indicator:subscribe("mouse.entered", function(_)
	sbar.animate("tanh", 30, function()
		spaces_indicator:set({
			background = {
				color = { alpha = 1.0 },
				border_color = { alpha = 1.0 },
			},
			icon = { color = colors.bg1 },
			label = { width = "dynamic" },
		})
	end)
end)

spaces_indicator:subscribe("mouse.exited", function(_)
	sbar.animate("tanh", 30, function()
		spaces_indicator:set({
			background = {
				color = { alpha = 0.0 },
				border_color = { alpha = 0.0 },
			},
			icon = { color = colors.grey },
			label = { width = 0 },
		})
	end)
end)

spaces_indicator:subscribe("mouse.clicked", function(_)
	sbar.trigger("swap_menus_and_spaces")
end)
