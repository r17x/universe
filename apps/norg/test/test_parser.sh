#!/bin/bash

# Debug parser script for finding hanging issues
# Usage: ./debug_parser.sh [test_name]

set -e

TIMEOUT=${TIMEOUT:-10}
OUTPUT_FORMAT=${OUTPUT_FORMAT:-markdown}

test_metadata() {
    cat > debug_test.norg << 'EOF'
@document.meta
title: Test
@end

Simple text.
EOF
    echo "Testing metadata parsing..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_complex_link() {
    cat > debug_test.norg << 'EOF'
This is a [Neorg]{https://github.com/nvim-neorg/neorg} link.
EOF
    echo "Testing complex link parsing..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_anchor_link() {
    cat > debug_test.norg << 'EOF'
This is {* layers}[layer] syntax.
EOF
    echo "Testing anchor link parsing..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_italic_slash() {
    cat > debug_test.norg << 'EOF'
This is /italic text/ here.
EOF
    echo "Testing italic parsing..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_spec_subset() {
    cat > debug_test.norg << 'EOF'
* Introduction
  Before diving into the details we will start with an introduction. The Norg file format was
  designed as part of the [Neorg]{https://github.com/nvim-neorg/neorg} plugin for Neovim which was
  started by /Vhyrro (@vhyrro)/ in April 2021.
EOF
    echo "Testing spec subset..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_full_spec() {
    echo "Testing full specification.norg..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe specification.norg -- --output "${OUTPUT_FORMAT}"
}

test_underline() {
    cat > debug_test.norg << 'EOF'
This is _underlined_ text.
EOF
    echo "Testing underline parsing..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_bold() {
    cat > debug_test.norg << 'EOF'
This is *bold* text.
EOF
    echo "Testing bold parsing..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_subscript() {
    cat > debug_test.norg << 'EOF'
This is ,subscript, text.
EOF
    echo "Testing subscript parsing..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_mixed_subscript() {
    cat > debug_test.norg << 'EOF'
This is ,subscript, text and regular, comma text.
Also ,another subscript, and more commas, in between.
EOF
    echo "Testing mixed subscript and comma parsing..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_comma_conflict() {
    cat > debug_test.norg << 'EOF'
Text, /italic text/ more, text.
EOF
    echo "Testing comma-italic conflict..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_all_inline() {
    cat > debug_test.norg << 'EOF'
This is *bold* and /italic/ and _underlined_ and -strikethrough- and !spoiler! text.
Also `inline code` and ^superscript^ and ,subscript, and $math$ markup.
EOF
    echo "Testing all inline markup..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_inline_code() {
    cat > debug_test.norg << 'EOF'
This is `code` text.
EOF
    echo "Testing inline code parsing..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_simple_subscript() {
    cat > debug_test.norg << 'EOF'
This is ,hello, subscript.
EOF
    echo "Testing simple subscript..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_comma_only() {
    cat > debug_test.norg << 'EOF'
This is a sentence, thus it should not have subscript.
EOF
    echo "Testing comma-only text..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_math() {
    cat > debug_test.norg << 'EOF'
This is $math$ formula.
EOF
    echo "Testing math markup..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_variable() {
    cat > debug_test.norg << 'EOF'
This is &variable& text.
EOF
    echo "Testing variable markup..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_spoiler() {
    cat > debug_test.norg << 'EOF'
This is !spoiler! text.
EOF
    echo "Testing spoiler markup..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_strikethrough() {
    cat > debug_test.norg << 'EOF'
This is -strikethrough- text.
EOF
    echo "Testing strikethrough markup..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_superscript() {
    cat > debug_test.norg << 'EOF'
This is ^superscript^ text.
EOF
    echo "Testing superscript markup..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_heading() {
    cat > debug_test.norg << 'EOF'
* Heading 1
** Heading 2
*** Heading 3
EOF
    echo "Testing heading markup..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_lists() {
    cat > debug_test.norg << 'EOF'
~ Ordered list item 1
~ Ordered list item 2
~~ Nested ordered item

- Unordered list item 1
- Unordered list item 2
-- Nested unordered item
EOF
    echo "Testing list markup..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_quotes() {
    cat > debug_test.norg << 'EOF'
> Quote level 1
>> Quote level 2
>>> Quote level 3
EOF
    echo "Testing quote markup..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_definitions() {
    cat > debug_test.norg << 'EOF'
$ Term
Definition content.

$$ Ranged Term
Multi-line definition content.
More content here.
$$
EOF
    echo "Testing definition markup..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_footnotes() {
    cat > debug_test.norg << 'EOF'
^ Footnote
Footnote content.

^^ Ranged Footnote
Multi-line footnote content.
More content here.
^^
EOF
    echo "Testing footnote markup..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_json_output() {
    cat > debug_test.norg << 'EOF'
This is *bold* and /italic/ text.
EOF
    echo "Testing JSON output format..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output json
}

test_html_output() {
    cat > debug_test.norg << 'EOF'
This is *bold* and /italic/ text.
EOF
    echo "Testing HTML output format..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output html
}

test_simple() {
    cat > debug_test.norg << 'EOF'
simple
EOF
    echo "Testing simple text..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

test_binary_search() {
    echo "Binary search through specification.norg..."
    
    # Get first N lines and test
    local lines=${1:-50}
    head -n "${lines}" specification.norg > debug_test.norg
    echo "Testing first ${lines} lines..."
    timeout "${TIMEOUT}"s dune exec ./bin/main.exe debug_test.norg -- --output "${OUTPUT_FORMAT}"
}

cleanup() {
    rm -f debug_test.norg
}

trap cleanup EXIT

case "${1:-all}" in
    "metadata") test_metadata ;;
    "complex_link") test_complex_link ;;
    "anchor_link") test_anchor_link ;;
    "italic") test_italic_slash ;;
    "spec_subset") test_spec_subset ;;
    "full_spec") test_full_spec ;;
    "binary_search") test_binary_search "${2:-50}" ;;
    "underline") test_underline ;;
    "bold") test_bold ;;
    "subscript") test_subscript ;;
    "mixed_subscript") test_mixed_subscript ;;
    "comma_conflict") test_comma_conflict ;;
    "all_inline") test_all_inline ;;
    "inline_code") test_inline_code ;;
    "simple_subscript") test_simple_subscript ;;
    "comma_only") test_comma_only ;;
    "math") test_math ;;
    "variable") test_variable ;;
    "spoiler") test_spoiler ;;
    "strikethrough") test_strikethrough ;;
    "superscript") test_superscript ;;
    "heading") test_heading ;;
    "lists") test_lists ;;
    "quotes") test_quotes ;;
    "definitions") test_definitions ;;
    "footnotes") test_footnotes ;;
    "json_output") test_json_output ;;
    "html_output") test_html_output ;;
    "simple") test_simple ;;
    "inline_tests")
        echo "Running all inline markup tests..."
        test_bold && echo "✓ Bold OK"
        test_italic_slash && echo "✓ Italic OK"
        test_underline && echo "✓ Underline OK"
        test_strikethrough && echo "✓ Strikethrough OK"
        test_spoiler && echo "✓ Spoiler OK"
        test_superscript && echo "✓ Superscript OK"
        test_subscript && echo "✓ Subscript OK"
        test_inline_code && echo "✓ Inline code OK"
        test_math && echo "✓ Math OK"
        test_variable && echo "✓ Variable OK"
        test_all_inline && echo "✓ All inline markup OK"
        ;;
    "block_tests")
        echo "Running all block markup tests..."
        test_heading && echo "✓ Headings OK"
        test_lists && echo "✓ Lists OK"
        test_quotes && echo "✓ Quotes OK"
        test_definitions && echo "✓ Definitions OK"
        test_footnotes && echo "✓ Footnotes OK"
        ;;
    "output_tests")
        echo "Running all output format tests..."
        test_json_output && echo "✓ JSON output OK"
        test_html_output && echo "✓ HTML output OK"
        ;;
    "all")
        echo "Running all tests..."
        test_metadata && echo "✓ Metadata OK"
        test_complex_link && echo "✓ Complex link OK"
        test_anchor_link && echo "✓ Anchor link OK"
        test_italic_slash && echo "✓ Italic OK"
        test_underline && echo "✓ Underline OK"
        test_bold && echo "✓ Bold OK"
        test_subscript && echo "✓ Subscript OK"
        test_mixed_subscript && echo "✓ Mixed subscript OK"
        test_comma_conflict && echo "✓ Comma conflict OK"
        test_all_inline && echo "✓ All inline markup OK"
        test_heading && echo "✓ Headings OK"
        test_lists && echo "✓ Lists OK"
        test_quotes && echo "✓ Quotes OK"
        test_definitions && echo "✓ Definitions OK"
        test_footnotes && echo "✓ Footnotes OK"
        test_json_output && echo "✓ JSON output OK"
        test_html_output && echo "✓ HTML output OK"
        test_spec_subset && echo "✓ Spec subset OK"
        test_full_spec && echo "✓ Full spec OK"
        ;;
    *)
        echo "Usage: $0 [test_name|category|all]"
        echo ""
        echo "Individual tests:"
        echo "  metadata, complex_link, anchor_link, italic, underline, bold"
        echo "  subscript, mixed_subscript, comma_conflict, simple_subscript, comma_only"
        echo "  inline_code, math, variable, spoiler, strikethrough, superscript"
        echo "  heading, lists, quotes, definitions, footnotes"
        echo "  json_output, html_output, simple, spec_subset, full_spec"
        echo ""
        echo "Test categories:"
        echo "  inline_tests   - All inline markup tests"
        echo "  block_tests    - All block markup tests"
        echo "  output_tests   - All output format tests"
        echo "  all_inline     - Combined inline markup test"
        echo "  all            - All tests"
        echo ""
        echo "Utilities:"
        echo "  binary_search [N] - Test first N lines of specification"
        echo ""
        echo "Environment variables:"
        echo "  TIMEOUT=10 (seconds)"
        echo "  OUTPUT_FORMAT=markdown"
        echo ""
        echo "Examples:"
        echo "  $0 binary_search 100"
        echo "  $0 inline_tests"
        echo "  $0 underline"
        echo "  TIMEOUT=5 OUTPUT_FORMAT=json $0 all_inline"
        exit 1
        ;;
esac