# this declarations based on {https://github.com/r17x/nixpkgs/blob/main/configs/nvim/lua/config/keymap.lua}
{
  icons,
  helpers,
  ...
}:

let
  inherit (helpers) mkLuaFun;
  resize.up = mkLuaFun "vim.cmd [[ resize +1 ]] ";
  resize.down = mkLuaFun "vim.cmd [[ resize -1 ]] ";
  resize.left = mkLuaFun "vim.cmd [[ vertical resize -1 ]] ";
  resize.right = mkLuaFun "vim.cmd [[ vertical resize +1 ]] ";
in
{
  clipboard.register = "unnamed";

  plugins = {
    telescope = {
      enable = true;
      lazyLoad.settings.cmd = "Telescope";
      keymaps.ff.options.desc = "Find by files";
      keymaps.ff.action = "find_files";
      keymaps.fF.options.desc = "Find by words";
      keymaps.fF.action = "live_grep";
      keymaps."f'".options.desc = "Find by String";
      keymaps."f'".action = "grep_string";
      keymaps.fb.options.desc = "Find by current buffers";
      keymaps.fb.action = "buffers";
      keymaps.fB.options.desc = "Find Fuzz by current buffers";
      keymaps.fB.action = "current_buffer_fuzzy_find";
      keymaps.fh.options.desc = "Find by help tags";
      keymaps.fh.action = "help_tags";
      keymaps.fc.options.desc = "Find by Colorscheme";
      keymaps.fc.action = "colorscheme";
      keymaps.fC.options.desc = "Find by highlights";
      keymaps.fC.action = "highlights";
    };

    hop = {
      enable = true;
      lazyLoad = {
        enable = true;
        settings.event = "VimEnter";
      };
    };

    which-key.enable = true;
    which-key.settings.triggers = [
      {
        __unkeyed-1 = "<leader>";
        mode = "n";
      }

      {
        __unkeyed-1 = "g";
        mode = "n";
      }

      {
        __unkeyed-1 = "z";
        mode = "n";
      }

      {
        __unkeyed-1 = "f";
        mode = "n";
      }

      {
        __unkeyed-1 = "t";
        mode = "n";
      }

    ];
    which-key.settings.spec = [
      {
        __unkeyed-1 = "<leader>nn";
        __unkeyed-2 = "<cmd>new<cr>";
        desc = "New Buffer Horizontal";
        icon = icons.horizontal;
      }
      {
        __unkeyed-1 = "<leader>ns";
        __unkeyed-2 = "<cmd>vnew<cr>";
        desc = "New Buffer Vertical";
        icon = icons.vertical;
      }
      {
        __unkeyed-1 = "<c-a>";
        __unkeyed-2 = "<cmd>sp<cr>";
        desc = "Split Horizontal";
        icon = icons.horizontal;
      }
      {
        __unkeyed-1 = "<c-s>";
        __unkeyed-2 = "<cmd>vsp<cr>";
        desc = "Split Vertical";
        icon = icons.vertical;
      }
      {
        __unkeyed-1 = "ft";
        __unkeyed-2 = "<cmd>Telescope<cr>";
        desc = "Open Telescope";
        icon = icons.telescope;
      }

      {
        __unkeyed-1 = "<leader>w";
        __unkeyed-2 = "<cmd>w<cr>";
        desc = "Write current buffer";
        icon = icons.save;
      }

      {
        __unkeyed-1 = "<leader>W";
        __unkeyed-2 = "<cmd>w!<cr>";
        desc = "Write current buffer forced";
        icon = icons.save;
      }

      {
        __unkeyed-1 = "<leader>q";
        __unkeyed-2 = "<cmd>wq<cr>";
        desc = "Write current buffer and quit";
        icon = icons.save;
      }

      {
        __unkeyed-1 = "<leader>Q";
        __unkeyed-2 = "<cmd>wq<cr>";
        desc = "Write & quit forced";
        icon = icons.save;
      }

      {
        __unkeyed-1 = "Y";
        __unkeyed-2 = "\"+yy";
        desc = "Copy to Clipboard!";
        icon = icons.clipboard;
      }

      {
        __unkeyed-1 = "p";
        __unkeyed-2 = "\"+p";
        desc = "Paste from Clipboard";
        icon = icons.paste;
      }

      {
        __unkeyed-1 = "<c-h>";
        __unkeyed-2 = "<c-w>h";
        desc = "Move top";
        icon = icons.top;
      }

      {
        __unkeyed-1 = "<c-j>";
        __unkeyed-2 = "<c-w>j";
        desc = "Move down";
        icon = icons.bottom;
      }

      {
        __unkeyed-1 = "<c-k>";
        __unkeyed-2 = "<c-w>k";
        desc = "Move left";
        icon = icons.left;
      }

      {
        __unkeyed-1 = "<c-l>";
        __unkeyed-2 = "<c-w>l";
        desc = "Move right";
        icon = icons.right;
      }

      {
        __unkeyed-1 = "fw";
        __unkeyed-2 = "<cmd>HopWord<cr>";
        desc = "Find by Word";
      }

      {
        __unkeyed-1 = "fhh";
        __unkeyed-2 = "<cmd>HopPattern<cr>";
        desc = "Find by Patterns";
      }

      {
        __unkeyed-1 = "<up>";
        __unkeyed-2.__raw = resize.up;
        desc = "resize window up";
      }

      {
        __unkeyed-1 = "<down>";
        __unkeyed-2.__raw = resize.down;
        desc = "resize window down";
      }

      {
        __unkeyed-1 = "<left>";
        __unkeyed-2.__raw = resize.left;
        desc = "resize window right";
      }

      {
        __unkeyed-1 = "<right>";
        __unkeyed-2.__raw = resize.right;
        desc = "resize window left";
      }

    ];
  };
}
