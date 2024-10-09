{ icons, ... }:

{
  plugins.avante.enable = true;
  plugins.avante.settings.provider = "claude";
  plugins.avante.settings.claude.api_key_name = "cmd:pass show r17x/anthropic";
  plugins.avante.settings.claude.endpoint = "https://api.anthropic.com";
  plugins.avante.settings.claude.model = "claude-3-5-sonnet-20240620";
  plugins.avante.settings.claude.temperature = 0;
  plugins.avante.settings.claude.max_tokens = 4096;

  plugins.which-key.settings.spec = [

    {
      __unkeyed-1 = "<leader>ca";
      __unkeyed-2 = icons.withIcon "robotFace" "<cmd>AvanteAsk<cr>";
      desc = "Open AI Ask";
    }

    {
      __unkeyed-1 = "<leader>cc";
      __unkeyed-2 = icons.withIcon "robotFace" "<cmd>AvanteChat<cr>";
      desc = "Open AI Chat";
    }

    {
      __unkeyed-1 = "<leader>ce";
      __unkeyed-2 = icons.withIcon "robotFace" "<cmd>AvanteEdit<cr>";
      desc = "Edit with instruction";
    }

    {
      __unkeyed-1 = "<leader>cg";
      __unkeyed-2 = icons.withIcon "robotFace" "<cmd>ChatGPTRun grammar_correction<cr>";
      desc = "Grammar Correction";
    }

    {
      __unkeyed-1 = "<leader>ct";
      __unkeyed-2 = icons.withIcon "robotFace" "<cmd>ChatGPTRun translate<cr>";
      desc = "Translate";
    }

    {
      __unkeyed-1 = "<leader>ck";
      __unkeyed-2 = icons.withIcon "robotFace" "<cmd>ChatGPTRun keywords<cr>";
      desc = "Keywords";
    }

    {
      __unkeyed-1 = "<leader>cd";
      __unkeyed-2 = icons.withIcon "robotFace" "<cmd>ChatGPTRun docstring<cr>";
      desc = "Docstring";
    }

    {
      __unkeyed-1 = "<leader>ca";
      __unkeyed-2 = icons.withIcon "robotFace" "<cmd>ChatGPTRun add_tests<cr>";
      desc = "Add Tests";
    }

    {
      __unkeyed-1 = "<leader>co";
      __unkeyed-2 = icons.withIcon "robotFace" "<cmd>ChatGPTRun optimize_code<cr>";
      desc = "Optimize Code";
    }

    {
      __unkeyed-1 = "<leader>cs";
      __unkeyed-2 = icons.withIcon "robotFace" "<cmd>ChatGPTRun summarize<cr>";
      desc = "Summarize";
    }

    {
      __unkeyed-1 = "<leader>cf";
      __unkeyed-2 = icons.withIcon "robotFace" "<cmd>ChatGPTRun fix_bugs<cr>";
      desc = "Fix Bugs";
    }

    {
      __unkeyed-1 = "<leader>cx";
      __unkeyed-2 = icons.withIcon "robotFace" "<cmd>ChatGPTRun explain_code<cr>";
      desc = "Explain Code";
    }

    {
      __unkeyed-1 = "<leader>cr";
      __unkeyed-2 = icons.withIcon "robotFace" "<cmd>ChatGPTRun roxygen_edit<cr>";
      desc = "Roxygen Edit";
    }

    {
      __unkeyed-1 = "<leader>cl";
      __unkeyed-2 = icons.withIcon "robotFace" "<cmd>ChatGPTRun code_readability_analysis<cr>";
      desc = "Code Readability Analysis";
    }
  ];
}
