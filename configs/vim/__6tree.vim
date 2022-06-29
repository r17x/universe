let g:NERDTreeGitStatusIndicatorMapCustom = {
            \    "Modified"  : "✹",
            \    "Staged"    : "✚",
            \    "Untracked" : "✭",
            \    "Renamed"   : "➜",
            \    "Unmerged"  : "═",
            \    "Deleted"   : "✖",
            \    "Dirty"     : "✗",
            \    "Clean"     : "✔︎",
            \    'Ignored'   : '☒',
            \    "Unknown"   : "?"
            \}

let g:NERDTreeGitStatusShowIgnored = 1

let g:NERDTreeIgnore = [
            \'\.d$[[node_modules|_esy|esy]]',
            \'\.pyc$',
            \'\.exe$',
            \'\.png$',
            \'\.jpg$',
            \'node_modules[[dir]]'
            \]
