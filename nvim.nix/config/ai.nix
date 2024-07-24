{ ... }:

{
  # extraPlugins = with pkgs.vimPlugins; [ 
  # ChatGPT-nvim 
  # ];

  # extraConfigLuaPost = ''
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
        {
          mode = [
            "n"
            "v"
          ];
        }
      ]
    ];

    "<leader>ce" = [
      [
        "<cmd>ChatGPTEditWithInstruction<cr>"
        "Edit with instruction"
        {
          mode = [
            "n"
            "v"
          ];
        }
      ]
    ];

    "<leader>cg" = [
      [
        "<cmd>ChatGPTRun grammar_correction<cr>"
        "Grammar Correction"
        {
          mode = [
            "n"
            "v"
          ];
        }
      ]
    ];

    "<leader>ct" = [
      [
        "<cmd>ChatGPTRun translate<cr>"
        "Translate"
        {
          mode = [
            "n"
            "v"
          ];
        }
      ]
    ];

    "<leader>ck" = [
      [
        "<cmd>ChatGPTRun keywords<cr>"
        "Keywords"
        {
          mode = [
            "n"
            "v"
          ];
        }
      ]
    ];

    "<leader>cd" = [
      [
        "<cmd>ChatGPTRun docstring<cr>"
        "Docstring"
        {
          mode = [
            "n"
            "v"
          ];
        }
      ]
    ];

    "<leader>ca" = [
      [
        "<cmd>ChatGPTRun add_tests<cr>"
        "Add Tests"
        {
          mode = [
            "n"
            "v"
          ];
        }
      ]
    ];

    "<leader>co" = [
      [
        "<cmd>ChatGPTRun optimize_code<cr>"
        "Optimize Code"
        {
          mode = [
            "n"
            "v"
          ];
        }
      ]
    ];

    "<leader>cs" = [
      [
        "<cmd>ChatGPTRun summarize<cr>"
        "Summarize"
        {
          mode = [
            "n"
            "v"
          ];
        }
      ]
    ];

    "<leader>cf" = [
      [
        "<cmd>ChatGPTRun fix_bugs<cr>"
        "Fix Bugs"
        {
          mode = [
            "n"
            "v"
          ];
        }
      ]
    ];

    "<leader>cx" = [
      [
        "<cmd>ChatGPTRun explain_code<cr>"
        "Explain Code"
        {
          mode = [
            "n"
            "v"
          ];
        }
      ]
    ];

    "<leader>cr" = [
      [
        "<cmd>ChatGPTRun roxygen_edit<cr>"
        "Roxygen Edit"
        {
          mode = [
            "n"
            "v"
          ];
        }
      ]
    ];

    "<leader>cl" = [
      [
        "<cmd>ChatGPTRun code_readability_analysis<cr>"
        "Code Readability Analysis"
        {
          mode = [
            "n"
            "v"
          ];
        }
      ]
    ];
  };
}
