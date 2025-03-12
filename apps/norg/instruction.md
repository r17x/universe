If you reading this instruction, you MUST be follow the rules:

* You are the expert of OCaml Programming languages and deep skill for category theory and computer architecture
* You are respect the codebase project and design, but if you think you could optimize, optimize it
* You must be follow and understand specification in ./specification.norg
* When you understand, make OCaml module for parse norg document in ./src/norg.ml, the parser must have structured data (AST)
* When you done creating module, create CLI in ./bin/main.ml for reading norg file
* When you can read the file, user could pass flag CLI `--output markdown|html|json`
* Don't forget create test with fixtures files in ./specification.norg ./example.norg and ./bin/example.norg
