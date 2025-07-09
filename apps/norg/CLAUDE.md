# Project Overview

Norg Parser

**Libraries**: norg 

## Workflow

1. **Start**: Read `TODO.norg` for current priorities
2. **Plan**: Complex tasks  → write plan in `.claude/plans/YYYY-MM-DD-description.md`
3. **Update**: Keep TODO.md current

### Testing & Debugging

**Dune watch mode** (the user typically runs dune build in watch mode outside Claude session):
- Check for `_build/.lock` to see if watch mode is active
- Build errors visible via `dune build <dir>` (works with watch mode)
- Run tests directly: `_build/default/test/test_foo.exe` (dune exec doesn't work with watch mode)
- **Never** kill dune, remove lock file, or clean build when watch mode is active
- In watch mode, When you make changes, check if there are build errors with `dune build <dir>` first, otherwise you'll be running the old tests.
- Do not create new stanzas (e.g. new `executable`), instead reuse existing stanzas (e.g. `executables`), otherwise dune watch mode won't build the new targets.

**Parser Testing Script** - `./test/test_parser.sh`:
- Comprehensive testing tool for parser functionality
- Individual tests: `./test/test_parser.sh <test_name>`
- Test categories: `inline_tests`, `block_tests`, `output_tests`, `all`
- Environment variables: `TIMEOUT=10`, `OUTPUT_FORMAT=markdown`
- No temporary files - all tests are self-contained
- Examples:
  - `./test/test_parser.sh underline` - Test underline markup
  - `./test/test_parser.sh inline_tests` - All inline markup tests
  - `./test/test_parser.sh binary_search 50` - Test first 50 lines of spec
  - `TIMEOUT=5 OUTPUT_FORMAT=json ./test/test_parser.sh all_inline`

When tests fail:
1. Use `./test/test_parser.sh` for targeted testing of specific markup
2. Create minimal repro in the test script if needed
3. Understand specifications in `./specification.norg`
4. Use `binary_search` function to isolate problematic content
5. **Never hack to pass tests**: Fix root cause, maintain correct semantics
   - View operations must not create copies
   - Don't change tests unless they're genuinely wrong

## Code Style

- **Naming**: `snake_case` for values/functions/types, `My_Module` for modules/variants
- **Philosophy**: Unix-style - do one thing well, fail loudly, clarity over cleverness
- **Interfaces**: One `.mli` per `.ml`, keep minimal
- **Docs**: Terse first line, document invariants not obvious behavior
- **Errors**: `function_name: what went wrong` format, fail fast
- **Tests**: Alcotest framework, test edge cases, group related tests
- **Type annotations**: Avoid explicit types unless required by type checker (dtype pattern matching)

## Critical Knowledge

- Don't clean the world: Never clean the dune cache or delete `_build` directory. The problem is not the build system.

### OCaml Gotchas

- **GADTs**: Can't group pattern match branches
- **Circular deps**: Watch for functions calling each other (use backend ops directly)
- **Dtype pattern matching**: Need locally abstract types: `let f (type a b) (x : (a, b) t) = match dtype x with ...`

## Alcotest Commands

### Running Tests
- Run all tests: `test.exe`
- List available tests: `test.exe list`
- Run specific tests by name regex: `test.exe test <NAME_REGEX>`
- Run specific test cases: `test.exe test <NAME_REGEX> <TESTCASES>`

### Useful Options
- Stop on first failure: `test.exe test --bail`
- Compact output: `test.exe test -c`
- Show test errors: `test.exe test -e`
- Run only quick tests: `test.exe test -q`
- Verbose output: `test.exe test -v`
