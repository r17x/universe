return function(client, bufnr)
    local function buf_set_option(...) vim.api.nvim_buf_set_option(bufnr, ...) end

    buf_set_option('omnifunc', 'v:lua.vim.lsp.omnifunc')

    -- Mappings
    local nnoremap = require('utils').nnoremap
    nnoremap('ff', '<cmd>lua vim.lsp.buf.formatting()<cr>')
    nnoremap('gD', '<cmd>lua vim.lsp.buf.declaration()<cr>')
    nnoremap('gd', '<cmd>lua vim.lsp.buf.definition()<cr>')
    nnoremap('K', '<cmd>lua vim.lsp.buf.hover()<cr>')
    nnoremap('gi', '<cmd>lua vim.lsp.buf.implementation()<cr>')
    nnoremap('gk', '<cmd>lua vim.lsp.buf.signature_help()<cr>')
    nnoremap('gr', '<cmd>lua vim.lsp.buf.references()<cr>')
    nnoremap('rn', '<cmd>lua vim.lsp.buf.rename()<cr>')
    nnoremap('[d', '<cmd>lua vim.lsp.diagnostic.goto_prev()<cr>')
    nnoremap(']d', '<cmd>lua vim.lsp.diagnostic.goto_next()<cr>')

    -- autoformat on save
    if client.resolved_capabilities.document_formatting then
      vim.cmd("autocmd BufWritePre <buffer> lua vim.lsp.buf.formatting_sync()")
    end
end
