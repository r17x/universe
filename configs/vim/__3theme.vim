" require 
"
" Plug 'vim-airline/vim-airline'
" Plug 'vim-airline/vim-airline-themes'
"
"
" Theme and Styling 
" 
syntax on

set background=dark " [ dark | light ]
set relativenumber
"set t_Co=256

" if (has("termguicolors"))
"   set termguicolors
" endif

" Vim-Airline Configuration
let g:airline#extensions#tabline#enabled = 0
let g:airline_powerline_fonts = 1 
let g:airline_theme='edge'

" edge options
let g:edge_style = 'neon'
let g:edge_disable_italic_comment = 1

" vim-one options
let g:one_allow_italics = 1

" Syntastic Configuration
" set statusline+=%#warningmsg#
" set statusline+=%{SyntasticStatuslineFlag()}
" set statusline+=%*

" 'ryanoasis/vim-devicons' 
let g:webdevicons_enable = 1
let g:WebDevIconsNerdTreeGitPluginForceVAlign = 0 

" colorizer
let g:colorizer_auto_filetype='css,html,js,jsx,json,yml,md,mdx,tsx,ts,less,scss'
let g:colorizer_colornames = 1
" au BufNewFile,BufRead *.css,*.html,*.htm,*.js,*.jsx,  :ColorHighlight!
let g:lightline = {
    \ 'colorscheme': 'edge'
    \}


if (has("termguicolors"))
  set termguicolors
endif

silent! colorscheme edge

let g:indentLine_leadingSpaceChar = '·'
let g:indentLine_ = '·'
