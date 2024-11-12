{ pkgs, icons, ... }:

{
  extraPlugins = with pkgs.vimPlugins; [
    supermaven-nvim
  ];

  plugins.avante.enable = true;
  plugins.avante.settings.provider = "claude";
  plugins.avante.settings.claude.api_key_name = "cmd:pass show r17x/anthropic";
  plugins.avante.settings.claude.endpoint = "https://api.anthropic.com";
  plugins.avante.settings.claude.model = "claude-3-5-sonnet-20240620";
  plugins.avante.settings.claude.temperature = 0;
  plugins.avante.settings.claude.max_tokens = 4096;

  plugins.avante.settings.vendors.ollama = {
    local = true;
    endpoint = "http://localhost:11434/v1";
    model = "qwen2.5-coder";
    temperature = 0;
    max_tokens = 4096;
    parse_curl_args.__raw = # lua
      ''
        function(opts, code_opts)
            return {
                url = opts.endpoint .. "/chat/completions",
                headers = {
                    ["Accept"] = "application/json",
                    ["Content-Type"] = "application/json",
                    ['x-api-key'] = 'ollama',
                },
                body = {
                    model = opts.model,
                    messages = require("avante.providers").copilot.parse_message(code_opts),
                    max_tokens = opts.max_tokens,
                    stream = true,
                },
            }
        end
      '';
    parse_response_data.__raw = # lua
      ''
        function(data_stream, event_state, opts)
          require("avante.providers").openai.parse_response(data_stream, event_state, opts)
        end
      '';
  };

  plugins.codeium-nvim.enable = true;
  plugins.codeium-nvim.settings.config_path.__raw = # lua
    ''
      vim.env.HOME .. '/.config/sops-nix/secrets/codeium'
    '';

  plugins.cmp.settings.sources = [
    { name = "codeium"; }
    { name = "supermaven"; }
  ];

  plugins.which-key.settings.spec = [

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

  extraConfigLuaPost = # lua
    ''
      -- supermaven
      require("supermaven-nvim").setup({
        disable_keymaps = true
      })

    '';

}
