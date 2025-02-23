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
      settings = {
        provider = "claude";

        claude.api_key_name = "cmd:pass show r17x/anthropic";
        claude.endpoint = "https://api.anthropic.com";
        claude.model = "claude-3-5-sonnet-20240620";
        claude.temperature = 0;
        claude.max_tokens = 4096;

        copilot.model = "claude-3.5-sonnet";
        copilot.temperature = 0;
        copilot.max_tokens = 4096;

        vendors = rec {
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

      {
        __unkeyed-1 = "<leader>cg";
        __unkeyed-2 = "<cmd>ChatGPTRun grammar_correction<cr>";
        icon = icons.robotFace;
        desc = "Grammar Correction";
      }

      {
        __unkeyed-1 = "<leader>ct";
        __unkeyed-2 = "<cmd>ChatGPTRun translate<cr>";
        icon = icons.robotFace;
        desc = "Translate";
      }

      {
        __unkeyed-1 = "<leader>ck";
        __unkeyed-2 = "<cmd>ChatGPTRun keywords<cr>";
        icon = icons.robotFace;
        desc = "Keywords";
      }

      {
        __unkeyed-1 = "<leader>cd";
        __unkeyed-2 = "<cmd>ChatGPTRun docstring<cr>";
        icon = icons.robotFace;
        desc = "Docstring";
      }

      {
        __unkeyed-1 = "<leader>co";
        __unkeyed-2 = "<cmd>ChatGPTRun optimize_code<cr>";
        icon = icons.robotFace;
        desc = "Optimize Code";
      }

      {
        __unkeyed-1 = "<leader>cs";
        __unkeyed-2 = "<cmd>ChatGPTRun summarize<cr>";
        icon = icons.robotFace;
        desc = "Summarize";
      }

      {
        __unkeyed-1 = "<leader>cf";
        __unkeyed-2 = "<cmd>ChatGPTRun fix_bugs<cr>";
        icon = icons.robotFace;
        desc = "Fix Bugs";
      }

      {
        __unkeyed-1 = "<leader>cx";
        __unkeyed-2 = "<cmd>ChatGPTRun explain_code<cr>";
        icon = icons.robotFace;
        desc = "Explain Code";
      }

      {
        __unkeyed-1 = "<leader>cr";
        __unkeyed-2 = "<cmd>ChatGPTRun roxygen_edit<cr>";
        icon = icons.robotFace;
        desc = "Roxygen Edit";
      }

      {
        __unkeyed-1 = "<leader>cl";
        __unkeyed-2 = "<cmd>ChatGPTRun code_readability_analysis<cr>";
        icon = icons.robotFace;
        desc = "Code Readability Analysis";
      }
    ];

  };

}
