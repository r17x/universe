"""""""""""""""""""""""""""""""""""""
" Common 
"""""""""""""""""""""""""""""""""""""
if !has('nvim')
  set ttymouse=xterm2
endif

if has('nvim')
  if exists(':tnoremap')
    tnoremap <Esc> <C-\><C-n>
  endif
endif

if has('macunix')
  " OSX stupid backspace fix
  set backspace=indent,eol,start
endif  

" Enable highlighting of the current line
set cursorline
" set guicursor=n-v-c-sm:block,i-ci-ve:ver25,r-cr-o:hor20
" hi CursorLine cterm=none
" hi CursorLine gui=none
if exists('$TMUX')
    let &t_SI .= "\ePtmux;\e\e[=1c\e\\"
    let &t_EI .= "\ePtmux;\e\e[=2c\e\\"
else
    let &t_SI .= "\e[=1c"
    let &t_EI .= "\e[=2c"
endif    

" Enable Elite mode, No ARRRROWWS!!!!
let g:elite_mode=1

set nowrap
" Show linenumbers
set number

" Set Proper Tabs
set tabstop=2
set shiftwidth=2
set smarttab
set expandtab

" Always display the status line
set laststatus=2

" Enable Foldable
" zo opens a fold at the cursor.
" zO opens all folds at the cursor.
" zc closes a fold at the cursor.
" zm increases the foldlevel by one.
" zM closes all open folds.
" zr decreases the foldlevel by one.
" zR decreases the foldlevel to zero -- all folds will be open.
set foldmethod=syntax

" Organizing SWP file
" set directory^=$HOME/.vim/tmp//
" @see {@links https://medium.com/@Aenon/vim-swap-backup-undo-git-2bf353caa02f}
set backupdir=.backup/,~/.backup/,/tmp//
set directory=.swp/,~/.swp/,/tmp//
set undodir=.undo/,~/.undo/,/tmp//

set nocompatible
filetype plugin on
