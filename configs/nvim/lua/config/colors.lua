local M = {}
-- example palette {{{
-- let palette = {
-- \ 'black':      ['#202023',   '232'],
-- \ 'bg_dim':     ['#252630',   '232'],
-- \ 'bg0':        ['#2b2d3a',   '235'],
-- \ 'bg1':        ['#333648',   '236'],
-- \ 'bg2':        ['#363a4e',   '237'],
-- \ 'bg3':        ['#393e53',   '237'],
-- \ 'bg4':        ['#3f445b',   '238'],
-- \ 'bg_grey':    ['#7a819d',   '246'],
-- \ 'bg_red':     ['#ec7279',   '203'],
-- \ 'diff_red':   ['#55393d',   '52'],
-- \ 'bg_green':   ['#a0c980',   '107'],
-- \ 'diff_green': ['#394634',   '22'],
-- \ 'bg_blue':    ['#6cb6eb',   '110'],
-- \ 'diff_blue':  ['#354157',   '17'],
-- \ 'bg_purple':  ['#d38aea',   '176'],
-- \ 'diff_yellow':['#4e432f',   '54'],
-- \ 'red':        ['#ec7279',   '203'],
-- \ 'yellow':     ['#deb974',   '179'],
-- \ 'green':      ['#a0c980',   '107'],
-- \ 'cyan':       ['#5dbbc1',   '72'],
-- \ 'blue':       ['#6cb6eb',   '110'],
-- \ 'purple':     ['#d38aea',   '176'],
-- \ 'none':       ['NONE',      'NONE']
-- \ }
-- }}}
function M.get_palette()
	-- configurations
	local s = vim.fn["edge#get_configuration"]()
	return vim.fn["edge#get_palette"](s.style, s.dim_foreground, s.colors_override)
end

return M
