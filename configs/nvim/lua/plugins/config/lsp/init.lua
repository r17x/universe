local setup = require 'plugins.config.lsp.setup'
local capabilities = require 'plugins.config.lsp.capabilities'
local attach = require 'plugins.config.lsp.attach'

setup.handlers()
setup.lsp(attach, capabilities)
