{
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

  plugins = {
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
        provider = "claude";

        claude.api_key_name = "cmd:pass show r17x/anthropic";
        claude.endpoint = "https://api.anthropic.com";
        claude.model = "claude-3-7-sonnet-20250219";
        claude.temperature = 0.7;
        claude.max_tokens = 20000;

        copilot.model = "claude-3.5-sonnet";
        copilot.temperature = 0.3;
        copilot.max_tokens = 20000;

        vendors = rec {
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

    codeium-nvim.enable = false;
    codeium-nvim.settings.config_path.__raw = # lua
      ''
        vim.env.HOME .. '/.config/sops-nix/secrets/codeium'
      '';
    cmp.settings.sources =
      lib.optionals plugins.codeium-nvim.enable [
        { name = "codeium"; }
      ]
      ++ lib.optionals plugins.copilot-lua.enable [
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
