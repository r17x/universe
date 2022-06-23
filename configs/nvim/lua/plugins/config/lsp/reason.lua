local M = {
  name = "reason"
}

M.setup = function(opts)
  local job = require("plenary.job")
  local utils = require('utils')
  local version = opts.version or "1.7.13"
  local os_name
  if utils.os.name == "darwin" then
    os_name = "macos"
  else
    os_name = "linux"
  end

  local server = {
    archive = string.format("%s/rls-%s.zip", utils.path.cache, os_name),
    download = string.format("https://github.com/jaredly/reason-language-server/releases/download/%s/rls-%s.zip", version, os_name),
    bin = string.format("%s/rls-%s/reason-language-server", utils.path.cache, os_name)
  }

  if utils.isNotExist(server.bin) then
    local unarchive = job:new({
      command = "unzip",
      args = { "-o", server.archive, "-d", utils.path.cache},
      on_start = function()
        print("Unarchive reason-language-server...")
      end,
      on_exit = function(j)
        print("Done unarchive reason-languange-server")
        j:_stop()
      end
    })

    local download = job:new({
      command = "curl",
      args = {
        "-o",
        server.archive,
        "-L",
        server.download
      },
      on_start = function()
        print("Download reason-language-server...")
      end,
      on_exit = function (j)
        unarchive:start()
        j:_stop()
      end
    })

    if utils.isNotExist(server.archive) then
      download:start()
    end

  end

  local lspconfig = require('lspconfig')
  local configs = require('lspconfig/configs')

  configs[M.name] = {
    default_config = {
      cmd = {
        server.bin,
      },
      filetypes = {'reason'},
      root_dir = lspconfig.util.root_pattern('bsconfig.json', '.git'),
      settings = {}
    }
  }

  lspconfig[M.name] = configs[M.name]

  local capabilities = opts.capabilities or require('config.lsp.capabilities')
  local on_attach = opts.on_attach or require('config.lsp.on_attach')

  lspconfig[M.name].setup {
    capabilities = capabilities,
    on_attach = on_attach,
  }

  end

return M
