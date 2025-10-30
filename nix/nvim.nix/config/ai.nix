{
  pkgs,
  lib,
  icons,
  helpers,
  ...
}:

rec {
  autoCmd = [
    {
      # Disable cmp in neorepl
      event = [ "FileType" ];
      pattern = "neorepl";
      callback.__raw =
        helpers.mkLuaFun # lua
          ''
            require("cmp").setup.buffer { enabled = false }
          '';
    }
  ];

  extraPlugins = [
    pkgs.branches.master.vimPlugins.claudecode-nvim
  ];

  plugins = {
    lz-n.plugins = [
      {
        __unkeyed-1 = pkgs.branches.master.vimPlugins.claudecode-nvim.name;
        cmd = [
          "ClaudeCode"
          "ClaudeCodeFocus"
          "ClaudeCodeDiffDeny"
          "ClaudeCodeDiffAccept"
        ];
        after.__raw =
          helpers.mkLuaFun # lua
            ''
              require("claudecode").setup({
                  terminal = {
                  split_side = "right", -- "left" or "right"
                  split_width_percentage = 0.30,
                  provider = "native", -- "auto", "snacks", or "native"
                  auto_close = true,
                  snacks_win_opts = {}, -- Opts to pass to `Snacks.terminal.open()`
                },
              })
            '';
      }
    ];
    claude-code = {
      enable = false;
      settings.window = {
        position = "rightbelow vsplit";
        split_ratio = 0.45;
      };
      lazyLoad.enable = true;
      lazyLoad.settings.cmd = [
        "ClaudeCode"
        "ClaudeCodeContinue"
        "ClaudeCodeResume"
        "ClaudeCodeVerbose"
      ];
    };
    avante = {
      enable = true;
      lazyLoad.enable = true;
      lazyLoad.settings.cmd = [
        "AvanteAsk"
        "AvanteBuild"
        "AvanteChat"
        "AvanteEdit"
        "AvanteFocus"
        "AvanteRefresh"
        "AvanteSwitchProvider"
        "AvanteShowRepoMap"
        "AvanteToggle"
      ];
      settings = {
        provider = "copilot";

        diff = {
          autojump = true;
          debug = false;
          list_opener = "copen";
        };

        highlights = {
          diff = {
            current = "GitConflictAncestor";
            incoming = "GitConflictIncoming";
          };
        };

        hints = {
          enabled = true;
        };

        claude.api_key_name = "cmd:pass show r17x/anthropic";
        claude.endpoint = "https://api.anthropic.com";
        claude.model = "claude-3-7-sonnet-20250219";
        claude.temperature = 0.7;
        claude.max_tokens = 20000;

        copilot.model = "claude-3.5-sonnet";
        copilot.temperature = 0.3;
        copilot.max_tokens = 20000;

        providers = rec {
          copilot37 = {
            model = "claude-3.7-sonnet";
            __inherited_from = "copilot";
          };
          grok = groq // {
            api_key_name = "cmd:pass show r17x/grok.api.key";
            model = "grok-2-latest";
            endpoint = "https://api.x.ai/v1";
          };
          groq = {
            api_key_name = "cmd:pass show r17x/groq.api.key";
            __inherited_from = "openai";
            endpoint = "https://api.groq.com/openai/v1";
            model = "llama-3.3-70b-versatile";
            max_tokens = 32768;
          };
          local-deepseeg = local-qwen // {
            model = "deepseek-r1:1.5b";
          };
          local-qwen = {
            api_key_name = "";
            __inherited_from = "openai";
            endpoint = "http://localhost:11434/v1";
            model = "qwen2.5-coder";
            temperature = 0;
            max_tokens = 4096;
          };
        };
      };
    };

    copilot-lua.enable = true;
    copilot-lua.settings.suggestion.enabled = false;
    copilot-lua.settings.panel.enabled = false;
    copilot-lua.lazyLoad.enable = true;
    copilot-lua.lazyLoad.settings.cmd = [ "Copilot" ];

    cmp.settings.sources = lib.optionals plugins.copilot-lua.enable [
      { name = "copilot"; }
    ];

    which-key.settings.spec = [
      {
        __unkeyed-1 = "ta";
        __unkeyed-2 = "<cmd>AvanteToggle<cr>";
        icon = icons.robotFace;
        desc = "Toggle Avante";
      }
      {
        __unkeyed-1 = "<leader>ca";
        __unkeyed-2 = "<cmd>AvanteAsk<cr>";
        icon = icons.robotFace;
        desc = "Open AI Ask";
      }

      {
        __unkeyed-1 = "<leader>cc";
        __unkeyed-2 = "<cmd>AvanteChat<cr>";
        icon = icons.robotFace;
        desc = "Open AI Chat";
      }

      {
        __unkeyed-1 = "<leader>ce";
        __unkeyed-2 = "<cmd>AvanteEdit<cr>";
        icon = icons.robotFace;
        desc = "Edit with instruction";
      }
    ];
  };
}
