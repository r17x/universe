-- local setup = require 'plugins.config.lsp.setup'

local capabilities = require 'plugins.config.lsp.capabilities'
local on_attach = require 'plugins.config.lsp.attach'

-- setup.handlers()
-- setup.lsp(on_attach, capabilities)
require("mason").setup({
  ui = {
    icons = {
      server_installed = "﫟",
      server_pending = "",
      server_uninstalled = "✗",
    },
  },
})

require("mason-lspconfig").setup({
  ensured_installed = {
    "sumneko_lua", "rescriptls", "tsserver", "eslint"
  }
})

require("mason-lspconfig").setup_handlers({
  function(server_name)
    require("lspconfig")[server_name].setup {
      on_attach = on_attach,
      capabilities = capabilities,
    }
  end,
})
