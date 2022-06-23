local M = {}

M.get_settings = function(name)
  local ok, settings = pcall(require, "settings.lsp." .. name)
  if ok then
   return settings
  end
  return {}
end

--- setup lsp with lsp-installer
M.lsp = function(attach, capabilities)
   local lsp_installer = require "nvim-lsp-installer"

   lsp_installer.settings {
      ui = {
         icons = {
            server_installed = "﫟" ,
            server_pending = "",
            server_uninstalled = "✗",
         },
      },
   }

   lsp_installer.on_server_ready(function(server)
      local settings = M.get_settings(server.name)
      local opts = {
          on_attach = attach,
          capabilities = capabilities,
          flags = {
             debounce_text_changes = 150,
          },
          settings = settings,
      }

      if server.name:match("eslint") then
        opts = {
          on_attach = function (client, bufnr)
            client.resolved_capabilities.document_formatting = true
            attach(client, bufnr)
          end,
          settings = { format = { enable = true } }
        }
      end

      if server.name:match("tsserver") then
        opts.on_attach = function(client,bufnr)
          client.resolved_capabilities.document_formatting = false
          attach(client, bufnr)
        end
      end

      server:setup(opts)

      vim.cmd [[ do User LspAttachBuffers ]]
   end)
end

M.handlers = function ()
  -- split when go to definition
  local function goto_definition(split_cmd)
    local util = vim.lsp.util
    local log = require("vim.lsp.log")
    local api = vim.api
    -- note, this handler style is for neovim 0.5.1/0.6, if on 0.5, call with function(_, method, result)
    local handler = function(_, result, ctx)
      if result == nil or vim.tbl_isempty(result) then
        local _ = log.info() and log.info(ctx.method, "No location found")
        return nil
      end
      if split_cmd then
        vim.cmd(split_cmd)
      end
      if vim.tbl_islist(result) then
        util.jump_to_location(result[1])
        if #result > 1 then
          util.set_qflist(util.locations_to_items(result))
          api.nvim_command("copen")
          api.nvim_command("wincmd p")
        end
      else
        util.jump_to_location(result)
      end
    end
    return handler
  end

  local function lspSymbol(name, icon)
      local hl = "DiagnosticSign" .. name
      vim.fn.sign_define(hl, { text = icon, numhl = hl, texthl = hl })
  end

  lspSymbol("Error", "")
  lspSymbol("Info", "")
  lspSymbol("Hint", "")
  lspSymbol("Warn", "")

  --- make go to definition split window
  vim.lsp.handlers["textDocument/definition"] = goto_definition('split')

  vim.lsp.handlers["textDocument/publishDiagnostics"] = vim.lsp.with(vim.lsp.diagnostic.on_publish_diagnostics, {
      virtual_text = {
         prefix = "",
         spacing = 0,
      },
      signs = true,
      underline = true,
      update_in_insert = false, -- update diagnostics insert mode
   })

  vim.lsp.handlers["textDocument/hover"] = vim.lsp.with(vim.lsp.handlers.hover, {
     border = "single",
  })

  vim.lsp.handlers["textDocument/signatureHelp"] = vim.lsp.with(vim.lsp.handlers.signature_help, {
     border = "single",
  })

  -- suppress error messages from lang servers
  vim.notify = function(msg, log_level)
     if msg:match "exit code" then
        return
     end
     if log_level == vim.log.levels.ERROR then
        vim.api.nvim_err_writeln(msg)
     else
        vim.api.nvim_echo({ { msg } }, true, {})
     end
  end
end

return M
