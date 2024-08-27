open Angstrom

module P = struct
  let is_space =
    function | ' ' | '\t' -> true | _ -> false 

  let _not_space = 
    fun c -> not (is_space c)
  
  let _is_eol =
    function | '\n' -> true | _ -> false

end

module PM = struct
  let eq a = 
    fun b -> a == b

  let is_special_char = function
    | '`' | '^' | ',' | '$' | '&' | '%'
    | '!' | '-' | '_' | '*' | '/' -> true
    | _ -> false

  let not_special_char = 
    fun c -> not (is_special_char c)

  let _spaces = 
    skip_while P.is_space

  let  p = 
    fun a -> char a *> take_till (eq a) <* char a

  (* 
    ** Basic Markup
     Here is how you can do very basic markup. First you see it raw, then rendered:
     - *bold*
     - /italic/
     - _underline_
     - -strikethrough-
     - !spoiler!
     - `inline code`
     - ^superscript^  (when nested into `subscript`, will highlight as an error)
     - ,subscript,    (when nested into `superscript`, will highlight as an error)
     - $f(x) = y$     (see also {# Math})
     - &variable&     (see also {# Variables})
     - %inline comment%
  *)
  let bold = p '*' 
  let italic = p '/' 
  let underline = p '_'
  let strikethrough = p '-'
  let spoiler = p '!'
  let inline_code = p '`'
  let superscript = p '^'
  let subscript = p ','
  let math = p '$'
  let variable = p '&'
  let inline_comment = p '%'
  let text = take_while1 not_special_char 
end

module T = struct
  let bold s = `Bold s
  let italic s = `Italic s
  let underline s = `Underline s
  let strikethrough s = `Strikethrough s
  let spoiler s = `Spoiler s
  let inline_code s = `InlineCode s
  let superscript s = `Superscript s
  let subscript s = `Subscript s
  let math s = `Math s
  let variable s = `Variable s
  let inline_comment s = `InlineComment s
  let text s = `Text s
  
  let to_string = function
    | `Bold s -> "Bold>*" ^ s ^ "*"
    | `Italic s -> "Italic>/" ^ s ^ "/"
    | `Underline s -> "Underline>_" ^ s ^ "_"
    | `Strikethrough s -> "Strikethrough>-" ^ s ^ "-"
    | `Spoiler s -> "Spoiler>!" ^ s ^ "!"
    | `InlineCode s -> "InlineCode>`" ^ s ^ "`" 
    | `Superscript s -> "Superscript>^" ^ s ^ "^" 
    | `Subscript s -> "Subscript>," ^ s ^ ","
    | `Math s -> "Math>$" ^ s ^ "$"
    | `Variable s -> "Variable>&" ^ s ^ "&"
    | `InlineComment s -> "InlineComment>%" ^ s ^ "%"
    | `Text s -> "Text>" ^ s
end

let block = 
  choice 
    [ PM.bold >>| T.bold
    ; PM.italic >>| T.italic
    ; PM.underline >>| T.underline
    ; PM.spoiler >>| T.spoiler
    ; PM.strikethrough >>| T.strikethrough
    ; PM.inline_code >>| T.inline_code
    ; PM.superscript >>| T.superscript
    ; PM.subscript >>| T.subscript
    ; PM.math >>| T.math
    ; PM.variable >>| T.variable
    ; PM.inline_comment >>| T.inline_comment
    ; PM.text >>| T.text
    ]

let document = many (block <* skip_many (char ' '))

let rec print_blocks = function
  | [] -> ()
  | x :: xs ->
    Printf.printf "%s\n" (T.to_string x);
    print_blocks xs

let parse_neorg input =
  match parse_string ~consume:All document input with
  | Ok blocks -> blocks
  | Error msg -> failwith msg

let neorg_document = {|
   Here is how you can do very basic markup. First you see it raw, then rendered:
   - *bold*
   - /italic/
   - _underline_
    -strikethrough-
   - !spoiler!
   - `inline code`
   - ^superscript^  (when nested into `subscript`, will highlight as an error)
   - ,subscript,    (when nested into `superscript`, will highlight as an error)
   - $f(x) = y$     (see also {# Math})
   - &variable&     (see also {# Variables})
   - %\inline comment%
  |}

let () =
  let blocks = parse_neorg neorg_document in
  Printf.printf "\n";
  print_blocks blocks
