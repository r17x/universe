{ ... }:

let
  mode = [
    "n"
    "v"
  ];
in
{
  # extraPlugins = with pkgs.vimPlugins; [ 
  # ChatGPT-nvim 
  # ];

  # extraConfigLuaPost =  # lua
  # ''
  #   require('chatgpt').setup({
  #     actions_paths = {"~/.config/openai/actions.json"},
  #     open_ai_params = {
  #       model = "gpt-4",
  #     },
  #     openai_edit_params = {
  #       model = "gpt-4",
  #     },
  #   })
  # '';

  plugins.which-key.registrations = {
    "<leader>cc" = [
      [
        "<cmd>ChatGPT<cr>"
        "Open ChatGPT Prompt"
        { inherit mode; }
      ]
    ];

    "<leader>ce" = [
      [
        "<cmd>ChatGPTEditWithInstruction<cr>"
        "Edit with instruction"
        { inherit mode; }
      ]
    ];

    "<leader>cg" = [
      [
        "<cmd>ChatGPTRun grammar_correction<cr>"
        "Grammar Correction"
        { inherit mode; }
      ]
    ];

    "<leader>ct" = [
      [
        "<cmd>ChatGPTRun translate<cr>"
        "Translate"
        { inherit mode; }
      ]
    ];

    "<leader>ck" = [
      [
        "<cmd>ChatGPTRun keywords<cr>"
        "Keywords"
        { inherit mode; }
      ]
    ];

    "<leader>cd" = [
      [
        "<cmd>ChatGPTRun docstring<cr>"
        "Docstring"
        { inherit mode; }
      ]
    ];

    "<leader>ca" = [
      [
        "<cmd>ChatGPTRun add_tests<cr>"
        "Add Tests"
        { inherit mode; }
      ]
    ];

    "<leader>co" = [
      [
        "<cmd>ChatGPTRun optimize_code<cr>"
        "Optimize Code"
        { inherit mode; }
      ]
    ];

    "<leader>cs" = [
      [
        "<cmd>ChatGPTRun summarize<cr>"
        "Summarize"
        { inherit mode; }
      ]
    ];

    "<leader>cf" = [
      [
        "<cmd>ChatGPTRun fix_bugs<cr>"
        "Fix Bugs"
        { inherit mode; }
      ]
    ];

    "<leader>cx" = [
      [
        "<cmd>ChatGPTRun explain_code<cr>"
        "Explain Code"
        { inherit mode; }
      ]
    ];

    "<leader>cr" = [
      [
        "<cmd>ChatGPTRun roxygen_edit<cr>"
        "Roxygen Edit"
        { inherit mode; }
      ]
    ];

    "<leader>cl" = [
      [
        "<cmd>ChatGPTRun code_readability_analysis<cr>"
        "Code Readability Analysis"
        { inherit mode; }
      ]
    ];
  };
}
