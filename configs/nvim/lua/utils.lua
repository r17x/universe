-- thanks to [at]nicknisi
-- https://github.com/nicknisi/dotfiles/blob/main/config/nvim/lua/M.lua
local api = vim.api
local fn = vim.fn
local opt = vim.opt
local cmd = vim.cmd
local g = vim.g
local M = {}
local fun = require('fun')

-- credits https://github.com/akinsho/dotfiles/blob/main/.config/nvim/lua/as/globals.lua
local function make_keymap_fn(mode, o)
  -- copy the opts table as extends will mutate opts
  local parent_opts = vim.deepcopy(o)
  return function(combo, mapping, opts)
    assert(combo ~= mode, string.format("The combo should not be the same as the mode for %s", combo))
    local _opts = opts and vim.deepcopy(opts) or {}

    if type(mapping) == "function" then
      local fn_id = globals._create(mapping)
      mapping = string.format("<cmd>lua globals._execute(%s)<cr>", fn_id)
    end

    if _opts.bufnr then
      local bufnr = _opts.bufnr
      _opts.bufnr = nil
      _opts = vim.tbl_extend("keep", _opts, parent_opts)
      api.nvim_buf_set_keymap(bufnr, mode, combo, mapping, _opts)
    else
      api.nvim_set_keymap(mode, combo, mapping, vim.tbl_extend("keep", _opts, parent_opts))
    end
  end
end

local map_opts = {noremap = false, silent = true}
M.nmap = make_keymap_fn("n", map_opts)
M.xmap = make_keymap_fn("x", map_opts)
M.imap = make_keymap_fn("i", map_opts)
M.vmap = make_keymap_fn("v", map_opts)
M.omap = make_keymap_fn("o", map_opts)
M.tmap = make_keymap_fn("t", map_opts)
M.smap = make_keymap_fn("s", map_opts)
M.cmap = make_keymap_fn("c", map_opts)

local noremap_opts = {noremap = true, silent = true}
M.nnoremap = make_keymap_fn("n", noremap_opts)
M.xnoremap = make_keymap_fn("x", noremap_opts)
M.vnoremap = make_keymap_fn("v", noremap_opts)
M.inoremap = make_keymap_fn("i", noremap_opts)
M.onoremap = make_keymap_fn("o", noremap_opts)
M.tnoremap = make_keymap_fn("t", noremap_opts)
M.cnoremap = make_keymap_fn("c", noremap_opts)

M.has_map = function(map, mode)
  mode = mode or "n"
  return fn.maparg(map, mode) ~= ""
end

M.has_module=function(name)
  if pcall(require, name) then
    return true
  else
    return false
  end
end

M.termcodes=function(str)
  return api.nvim_replace_termcodes(str, true, true, true)
end

-- apply options aka vim.opt
M.apply_options=function(options)
   fun.each( function(k,v) opt[k] = v end, options)
end
-- apply "cmd" vim
M.apply_cmd=function(cmds)
    fun.each( function(v) cmd(v) end, cmds)
end
-- apply vim global options
M.apply_g=function(gs)
    fun.each( function(k,v) g[k] = v end, gs)
end
-- apply mappings
M.apply_mappings = function(mappings)
  fun.each(
    function(k, vs)
      if k == "vmap" then
        fun.each( M.vmap, vs)
      end

      if k == "nnoremap" then
        fun.each( M.nnoremap, vs)
      end

      if k == "xnoremap" then
        fun.each( M.xnoremap, vs)
      end

      if k == "vnoremap" then
        fun.each( M.vnoremap, vs)
      end

      if k == "nmap" then
        fun.each( M.nmap, vs)
      end
    end,
    mappings
  )
end

M.apply_settings = function(settings)
  -- apply "g" options
  -- viml: let g:something = val
  M.apply_g(settings.g_options)
  -- apply options
  -- viml: set something
  M.apply_options(settings.options)
  -- apply command
  -- viml: something on
  M.apply_cmd(settings.cmd_options)
  -- apply mappings
  -- viml: nnoremap something value
  M.apply_mappings(settings.mappings)
end

return M
