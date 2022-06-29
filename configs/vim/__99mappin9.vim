"""""""""""""""""""""""""""""""""""""
" Mappings configurationn
" imap => insert mode 
" nmap => normal mode 
"
" <Space/> is our Leader 😎
"""""""""""""""""""""""""""""""""""""
nnoremap <SPACE> <Nop>
let mapleader = ' '
"""""""""""""""""""""""""""""""""""""
" mapping with Leader
"""""""""""""""""""""""""""""""""""""
" Copy & paste to system clipboard with {<Space> + p} and {<Space> + y}
vmap <Leader>y "+y
vmap <Leader>d "+d
nmap <Leader>p "+p
nmap <Leader>P "+P
vmap <Leader>p "+p
vmap <Leader>P "+P
vmap <Leader>cn :CarbonNowSh<CR>
nnoremap <Leader>bb :RescriptBuild<CR>
nnoremap <Leader>bc :RescriptCleanWorld<CR>
nnoremap <Leader>pp :Prettier<CR>
" Type {<Space> + n} for open zsh configuration
nnoremap <Leader><Tab> :NERDTreeToggle<CR>
" Type {<Space> + m} for open zsh configuration
nnoremap <Leader>tag :TagbarToggle<CR>
" Enter visual line mode with {<Space><Space>}
nmap <Leader><Leader> V
" Type {<Space> + v} for open new
nnoremap <Leader>v :vnew<CR> 
" Type {<Space> + vs} for open new split current
nnoremap <Leader>vs :vsp<CR> 
" Type {<Space> + ns} for open new split current
nnoremap <Leader>ns :sp<CR> 
" Type {<Space> + n} for open new split
nnoremap <Leader>n :new<CR> 
" Type {<Space> + o} for search file content (FZF)
nnoremap <Leader>o :Files<CR> 
" Type {<Space> + O} for search file content with RipGrep (FZF)
nnoremap <Leader>O :Rg<CR>
" Type {<Space> + wq} for writing and quit current file
nnoremap <Leader>wq :wq<CR>
" Type {<Space> + q} quit current file
nnoremap <Leader>q :q<CR>
" Type {<Space> + w} for writing current file
nnoremap <Leader>w :w<CR>
" Type {<Space> + f} for formatting current file when
" language server was integrated
nnoremap <Leader>f :Format<CR> 
" Type {<Space> + sc} for source current file
nnoremap <Leader>sc :source %<CR>
" Type {<Space> + rc} for reload vim configuration
nnoremap <Leader>rc :source $MYVIMRC<CR>
" Type {<Space> + oc} for open vim configuration
nnoremap <Leader>oc :tabnew ~/.vimrc<CR>
" Type {<Space> + coc} for open coc settings.json
nnoremap <Leader>coc :tabnew ~/.vim/coc-settings.json<CR>
" Type {<Space> + oz} for open zsh configuration
nnoremap <Leader>oz :tabnew ~/.zshrc<CR>
" Type {<Space> + om} for open zsh configuration
nnoremap <Leader>om :vnew ~/.vim/vimrc.d/__99mappin9.vim<CR>
" Type {<Space> + on} for open zsh configuration
nnoremap <Leader>on :tabnew ~/.config/nvim/init.vim<CR>
" Type {<Space> + oz} for open zsh configuration template
nnoremap <Leader>ozt :vnew ~/.zshrc\#\#template<CR>
" Type {<Space> + pi} for execute plug install
nnoremap <Leader>pi :PlugInstall<CR>
" Type {<Space> + pu} for execute plug clean
nnoremap <Leader>pu :PlugUpdate<CR>
" Type {<Space> + pc} for execute plug clean
nnoremap <Leader>pc :PlugClean<CR>
" Type {<Space> + cr} for restart coc.nvim
nnoremap <Leader>cr :CocRestart<CR>
" Type {<Space> + G} for Git file list
noremap <Leader>G :Git<CR>
" Type {<Space> + gf} for browse tracked git files in vim
noremap <Leader>gf :GFiles<CR> 
" Type {<Space> + gsp} for buffer(window) split 
noremap <Leader>gsp :Gsplit<CR> 
" Type {<Space> + gds} for split window and Git diff current file
noremap <Leader>gds :Gdiffsplit<CR> 
" Type {<Space> + gll} for Git log
noremap <Leader>gll :Glog<CR>
" Type {<Space> + gfa} for Git fetch all
noremap <Leader>gfa :Git fetch --all<CR>
" Type {<Space> + gs} for showing Git Status
noremap <Leader>gs :Gstatus<CR>
" Type {<Space> + gps} for executed Git Push  origin <current branch>
noremap <Leader>gps :Dispatch git push origin $(git rev-parse --abbrev-ref HEAD)<CR>
" Type {<Space> + gpsf} same as {gps} but force 
noremap <Leader>gpsf :Dispatch git push origin $(git rev-parse --abbrev-ref HEAD) --force<CR>
" Type {<Space> + gpl} for executed Git Pull
noremap <Leader>gpl :Gpull<CR>
" Type {<Space> + gw} for Git Add/Write
noremap <Leader>gw :Gwrite<CR> 
" Type {<Space> + gcm} for Git commit
noremap <Leader>gcm :Gcommit<CR>
" Type {<Space> + gmt} for Git mergetool
noremap <Leader>gmt :Git mergetool<CR>
" Type {<Space> + gnc} for git next conflicted (vim-conflicted)
noremap <Leader>gnc :GitNextConflict<CR>
" Type {<Space> + mdv} for markdown preview.
noremap <Leader>mdv :MarkdownPreviewToggle<CR>
" Type {<Space> + mdv} for markdown preview.
noremap <Leader>mdt :GenTocGFM<CR>
" Type {<Space> + idt} Indent Line Toggle
noremap <Leader>idt :IndentBlanklineToggleAll<CR>
" Type {<Space> + fc} focus
noremap <Leader>fc :Goyo<CR>
" Type {<Space> + cf} unfocus
noremap <Leader>cf :Goyo!<CR>
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
"" Mac User Map HJKL
imap ˙ <Left>
imap ∆ <Down>
imap ˚ <Up>
imap ¬ <Right>
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
nmap ;; :w<CR>
nmap ;: :wq<CR>
nmap :W :w<CR>
nmap :Q :q<CR>
nmap :Q! :q!<CR>
nmap :WQ :wq<CR>
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" mapping with CTRL (Control)
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Type {CTRL + p} for browse file (FZF)
map <C-p> :Files<CR>
" Type {CTRL + n}
" left side bar for browse files
map <C-n> :NERDTreeToggle<CR> 
" Type {CTRL + m}
" right side bar for definition of your code
" map <C-m> :TagbarToggle<CR>
" Type {Ctrl+h} for navigated to left
noremap <C-h> <C-w>h
" Type {Ctrl+j} for navigated to bottom
noremap <C-j> <C-w>j
" Type {Ctrl+k} for navigated to up
noremap <C-k> <C-w>k
" Type {Ctrl+l} for navigated to right
noremap <C-l> <C-w>l
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Disable arrow movement, resize splits instead.
" <- : for resize(+2) to left
" -> : for resize(+2) to righ
"  V : for resize(+2) to bottom
"  ^ : for resize(+2) to up
if get(g:, 'elite_mode')
    nnoremap <Up>    :resize +2<CR>
    nnoremap <Down>  :resize -2<CR>
    nnoremap <Left>  :vertical resize +2<CR>
    nnoremap <Right> :vertical resize -2<CR>
endif
" auto insert datetime
map <F3> :r !date --rfc-3339=s<cr>
" Use `gl` and `gu` rather than the default conflicted diffget mappings
let g:diffget_local_map = 'gl'
let g:diffget_upstream_map = 'gu'
" Discover text search object
vnoremap <silent> s //e<C-r>=&selection=='exclusive'?'+1':''<CR><CR>
    \:<C-u>call histdel('search',-1)<Bar>let @/=histget('search',-1)<CR>gv
omap s :normal vs<CR>
" Automatically jump to end of text you pasted:
" I can paste multiple lines multiple times with simple {ppppp}.
vnoremap <silent> y y`]
vnoremap <silent> p p`]
nnoremap <silent> p p`]
" Prevent replacing paste buffer on paste
" vp doesn't replace paste buffer
function! RestoreRegister()
  let @" = s:restore_reg
  return ''
endfunction
function! s:Repl()
  let s:restore_reg = @"
  return "p@=RestoreRegister()\<cr>"
endfunction
vmap <silent> <expr> p <sid>Repl()

" Type 12<Enter> to go to line 12
" Hit Enter to go to end of file.
" Hit Backspace to go to beginning of file.
nnoremap <CR> G
nnoremap <BS> gg
" mapping in inser and normal mode
" inoremap <silent> <C-T> <Esc>:NERDTreeToggle<CR>
" nnoremap <silent> <C-T> <Esc>:NERDTreeToggle<CR>




" inoremap <nowait> <A-j> <Esc>:m .+1<CR>==gi
" inoremap <nowait> <A-k> <Esc>:m .-2<CR>==gi
" nnoremap <nowait> <A-j> :m .+1<CR>==
" nnoremap <nowait> <A-k> :m .-2<CR>==
" vnoremap <nowait> <A-j> :m '>+1<CR>gv=gv
" vnoremap <nowait> <A-k> :m '<-2<CR>gv=gv

let s:hidden_all = 0
function! ToggleHiddenAll()
    if s:hidden_all  == 0
        let s:hidden_all = 1
        set noshowmode
        set noruler
        set laststatus=0
        set noshowcmd
    else
        let s:hidden_all = 0
        set showmode
        set ruler
        set laststatus=2
        set showcmd
    endif
endfunction
" use {Shift + H}
nnoremap <S-h> :call ToggleHiddenAll()<CR>
