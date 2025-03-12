module Ast = struct
  (* Define the Abstract Syntax Tree for Norg *)
  
  (* Basic inline elements *)
  type inline =
    | Text of string
    | Bold of inline list
    | Italic of inline list
    | Underline of inline list
    | Strikethrough of inline list
    | Spoiler of inline list
    | InlineCode of string
    | Superscript of inline list
    | Subscript of inline list
    | Math of string
    | Variable of string
    | InlineComment of string
    | Link of link
    | Anchor of anchor
    | InlineLinkTarget of string
  
  (* Link types *)
  and link =
    | LinkLocation of link_location * inline list option
    | InlineLink of string
  
  and link_location =
    | Heading of int * string
    | Definition of string
    | Footnote of string
    | FilePath of string * link_target option
    | LineNumber of int
    | Url of string
    | FileLink of string * int option
    | MagicLink of string
    | TimestampLink of string
    | WikiLink of string
    | ExtendableLink of string
  
  and link_target =
    | HeadingTarget of int * string
    | DefinitionTarget of string
    | FootnoteTarget of string
    | MagicTarget of string
    | LineNumberTarget of int
  
  (* Anchor for reversed link syntax *)
  and anchor =
    | AnchorDeclaration of string
    | AnchorDefinition of string * link_location
  
  (* Block elements *)
  type block =
    | Paragraph of inline list
    | Heading of int * string * block list
    | UnorderedList of int * block list
    | OrderedList of int * block list
    | Quote of int * block list
    | Definition of string * block list
    | DefinitionMulti of string * block list
    | Footnote of string * block list
    | FootnoteMulti of string * block list
    | CodeBlock of string option * string
    | Table of table
    | HorizontalRule
    | DetachedModifierExtension of extension
    | Tag of tag
  
  (* Extension for task tracking *)
  and extension =
    | TodoStatus of todo_status
    | Priority of string
    | DueDate of string
    | StartDate of string
    | Timestamp of string
  
  (* Todo status options *)
  and todo_status =
    | Undone
    | Done
    | NeedsInput
    | Urgent
    | Recurring of string option
    | InProgress
    | OnHold
    | Cancelled
  
  (* Table structure *)
  and table = {
    headers: string list option;
    rows: string list list;
  }
  
  (* Tags *)
  and tag =
    | RangedTag of ranged_tag
    | CarryoverTag of carryover_tag
    | InfirmTag of string * string list
  
  and ranged_tag =
    | MacroTag of string * string list * string
    | StandardTag of string * string list * block list
    | VerbatimTag of string * string list * string
  
  and carryover_tag =
    | Strong of string * string list * block
    | Weak of string * string list * block
  
  (* A document is a list of blocks *)
  type document = block list
end

module Parser = struct
  open Angstrom
  open Ast

  (* Helper functions for parsing *)
  let is_whitespace = function
    | ' ' | '\t' | '\r' -> true
    | _ -> false
  
  let is_newline = function
    | '\n' -> true
    | _ -> false
  
  let is_special_char = function
    | '*' | '/' | '_' | '-' | '!' | '`' | '^' | ',' 
    | '$' | '&' | '%' | '#' | '+' | '.' | '@' | '|' 
    | '=' | '{' | '}' | '[' | ']' | '<' | '>' | '\\' -> true
    | _ -> false
  
  let not_special_char c = not (is_special_char c)
  
  (* Basic parsers *)
  let whitespace = take_while is_whitespace
  let required_whitespace = take_while1 is_whitespace
  let newline = char '\n'
  let spaces = skip_while is_whitespace
  let spaces1 = skip_many1 (satisfy is_whitespace)
  
  (* Parsing text *)
  let text = take_while1 not_special_char >>| fun s -> Text s
  
  (* Escape sequences *)
  let escaped_char = char '\\' *> any_char >>| fun c -> Text (String.make 1 c)
  
  (* Basic inline formatting *)
  let parse_inline_element open_char close_char constructor content_parser =
    char open_char *> 
    content_parser <* 
    char close_char >>| constructor
  
  (* Parse free-form with pipe *)
  let parse_freeform_inline open_char close_char constructor =
    string (open_char ^ "|") *>
    take_till (fun c -> c = '|') <*
    string ("|" ^ close_char) >>|
    fun content -> constructor [Text content]
  
  (* Forward declarations for recursive parsers *)
  let parse_inline_content = 
    fix (fun parse_inline_content ->
    
    (* Bold parsing *)
    let parse_bold =
      parse_inline_element '*' '*' (fun content -> Bold content) parse_inline_content
      <|> parse_freeform_inline "*" "*" (fun x -> Bold x)
    in
    
    (* Italic parsing *)
    let parse_italic =
      parse_inline_element '/' '/' (fun content -> Italic content) parse_inline_content
      <|> parse_freeform_inline "/" "/" (fun x -> Italic x)
    in
    
    (* Underline parsing *)
    let parse_underline =
      parse_inline_element '_' '_' (fun content -> Underline content) parse_inline_content
      <|> parse_freeform_inline "_" "_" (fun x -> Underline x)
    in
    
    (* Strikethrough parsing *)
    let parse_strikethrough =
      parse_inline_element '-' '-' (fun content -> Strikethrough content) parse_inline_content
      <|> parse_freeform_inline "-" "-" (fun x -> Strikethrough x)
    in
    
    (* Spoiler parsing *)
    let parse_spoiler =
      parse_inline_element '!' '!' (fun content -> Spoiler content) parse_inline_content
      <|> parse_freeform_inline "!" "!" (fun x -> Spoiler x)
    in
    
    (* Verbatim inline code parsing *)
    let parse_inline_code =
      parse_inline_element '`' '`' (fun content -> InlineCode content) (take_till ((=) '`'))
      <|> parse_freeform_inline "`" "`" (fun _ -> InlineCode "")
    in
    
    (* Superscript parsing *)
    let parse_superscript =
      parse_inline_element '^' '^' (fun content -> Superscript content) parse_inline_content
      <|> parse_freeform_inline "^" "^" (fun x -> Superscript x)
    in
    
    (* Subscript parsing *)
    let parse_subscript =
      parse_inline_element ',' ',' (fun content -> Subscript content) parse_inline_content
      <|> parse_freeform_inline "," "," (fun x -> Subscript x)
    in
    
    (* Math parsing *)
    let parse_math =
      parse_inline_element '$' '$' (fun content -> Math content) (take_till ((=) '$'))
      <|> parse_freeform_inline "$" "$" (fun _ -> Math "")
    in
    
    (* Variable parsing *)
    let parse_variable =
      parse_inline_element '&' '&' (fun content -> Variable content) (take_till ((=) '&'))
      <|> parse_freeform_inline "&" "&" (fun _ -> Variable "")
    in
    
    (* Inline comment parsing *)
    let parse_inline_comment =
      parse_inline_element '%' '%' (fun content -> InlineComment content) (take_till ((=) '%'))
      <|> parse_freeform_inline "%" "%" (fun _ -> InlineComment "")
    in
    
    (* Link parsing - recursive parts *)
    let  parse_heading_target =
      lift2 
        (fun level title -> HeadingTarget (level, String.trim title))
        (char '*' *> many (char '*') >>| (fun stars -> 1 + List.length stars))
        (required_whitespace *> take_till ((=) '}'))
    in
    
    let parse_definition_target =
      char '$' *> required_whitespace *> take_till ((=) '}') >>| fun title ->
        DefinitionTarget (String.trim title)
    in
    
    let parse_footnote_target =
      char '^' *> required_whitespace *> take_till ((=) '}') >>| fun title ->
        FootnoteTarget (String.trim title)
    in
    
    let parse_magic_target =
      char '#' *> required_whitespace *> take_till ((=) '}') >>| fun title ->
        MagicTarget (String.trim title)
    in
    
    let parse_linenumber_target =
      take_while1 (fun c -> '0' <= c && c <= '9') >>| fun num ->
        LineNumberTarget (int_of_string num)
    in
    
    let parse_link_target =
      choice [
        parse_heading_target;
        parse_definition_target;
        parse_footnote_target;
        parse_magic_target;
        parse_linenumber_target;
      ] >>| fun target -> Some target
    in
    
    let parse_heading_link =
      lift2 
        (fun level title -> Heading (level, String.trim title, []))
        (char '*' *> many (char '*') >>| (fun stars -> 1 + List.length stars))
        (required_whitespace *> take_till ((=) '}'))
    in
    
    let parse_definition_link =
      char '$' *> required_whitespace *> take_till ((=) '}') >>| fun title ->
        Definition (String.trim title, [])
    in
    
    let parse_footnote_link =
      char '^' *> required_whitespace *> take_till ((=) '}') >>| fun title ->
        Footnote (String.trim title, [])
    in
    
    let parse_filepath_link =
      string ":" *> take_till ((=) ':') <* char ':' >>= fun path ->
        option None parse_link_target >>| fun target ->
          FilePath (path, target)
    in
    
    let parse_linenumber_link =
      take_while1 (fun c -> '0' <= c && c <= '9') >>| fun num ->
        LineNumber (int_of_string num)
    in
    
    let parse_url_link =
      (string "https://" <|> string "http://" <|> string "ftp://" <|> string "file://") >>= fun protocol ->
        take_till ((=) '}') >>| fun url ->
          Url (protocol ^ url)
    in
    
    let parse_file_link =
      char '/' *> required_whitespace *> take_till (fun c -> c = '}' || c = ':') >>= fun path ->
        option None (char ':' *> take_while1 (fun c -> '0' <= c && c <= '9') >>| int_of_string >>| fun line -> Some line) >>| fun line ->
          FileLink (path, line)
    in
    
    let parse_magic_link =
      char '#' *> required_whitespace *> take_till ((=) '}') >>| fun title ->
        MagicLink (String.trim title)
    in
    
    let parse_timestamp_link =
      char '@' *> required_whitespace *> take_till ((=) '}') >>| fun timestamp ->
        TimestampLink (String.trim timestamp)
    in
    
    let parse_wiki_link =
      char '?' *> required_whitespace *> take_till ((=) '}') >>| fun title ->
        WikiLink (String.trim title)
    in
    
    let parse_extendable_link =
      char '=' *> required_whitespace *> take_till ((=) '}') >>| fun content ->
        ExtendableLink (String.trim content)
    in
    
    let parse_link_location =
      choice [
        parse_heading_link;
        parse_definition_link;
        parse_footnote_link;
        parse_filepath_link;
        parse_linenumber_link;
        parse_url_link;
        parse_file_link;
        parse_magic_link;
        parse_timestamp_link;
        parse_wiki_link;
        parse_extendable_link;
      ]
    in
    
    let parse_link =
      (char '{' *> parse_link_location <* char '}' >>= fun loc ->
        option None (char '[' *> parse_inline_content <* char ']' >>| fun desc -> Some desc) >>| 
        fun desc -> Link (LinkLocation (loc, desc)))
      <|>
      (char '[' *> take_till ((=) ']') <* char ']' >>= fun anchor_text ->
        option (Link (LinkLocation (MagicLink anchor_text, None))) 
               (char '{' *> parse_link_location <* char '}' >>| fun loc -> 
                  Link (LinkLocation (loc, Some [Text anchor_text]))))
      <|>
      (string "<" *> take_till ((=) '>') <* char '>' >>| fun target ->
        Link (InlineLink target))
    in
    
    (* Parse inline content *)
    let parse_inline_element_choice =
      choice [
        parse_bold;
        parse_italic;
        parse_underline;
        parse_strikethrough;
        parse_spoiler;
        parse_inline_code;
        parse_superscript;
        parse_subscript;
        parse_math;
        parse_variable;
        parse_inline_comment;
        parse_link;
        escaped_char;
        text;
      ]
    in
    
    many parse_inline_element_choice
  )
  
  (* Paragraph parsing *)
  let parse_paragraph =
    parse_inline_content >>| fun inlines -> Paragraph inlines
  
  (* Document parsing *)
  let parse_document =
    fix (fun parse_document ->
      (* Heading parsing *)
      let parse_heading =
        lift3 
          (fun level title content -> Heading (level, title, content))
          (char '*' *> many (char '*') <* spaces >>| (fun stars -> 1 + List.length stars))
          (take_till is_newline <* newline)
          (many (parse_paragraph <* many newline))
      in
      
      (* Unordered list parsing *)
      let parse_unordered_list =
        lift2
          (fun level content -> UnorderedList (level, content))
          (char '-' *> many (char '-') <* spaces >>| (fun dashes -> 1 + List.length dashes))
          (parse_paragraph >>= fun p -> 
             many (parse_paragraph) >>| fun ps -> p :: ps)
      in
      
      (* Ordered list parsing *)
      let parse_ordered_list =
        lift2
          (fun level content -> OrderedList (level, content))
          (char '~' *> many (char '~') <* spaces >>| (fun tildes -> 1 + List.length tildes))
          (parse_paragraph >>= fun p -> 
             many (parse_paragraph) >>| fun ps -> p :: ps)
      in
      
      (* Quote parsing *)
      let parse_quote =
        lift2
          (fun level content -> Quote (level, content))
          (char '>' *> many (char '>') <* spaces >>| (fun quotes -> 1 + List.length quotes))
          (parse_paragraph >>= fun p -> 
             many (parse_paragraph) >>| fun ps -> p :: ps)
      in
      
      (* Definition parsing *)
      let parse_definition =
        lift2
          (fun title content -> Definition (title, content))
          (char '$' *> spaces *> take_till is_newline <* newline)
          (many parse_paragraph)
      in
      
      (* Multi-paragraph definition parsing *)
      let parse_definition_multi =
        lift2
          (fun title content -> DefinitionMulti (title, content))
          (string "$$" *> spaces *> take_till is_newline <* newline)
          (many parse_paragraph <* string "$$")
      in
      
      (* Footnote parsing *)
      let parse_footnote =
        lift2
          (fun title content -> Footnote (title, content))
          (char '^' *> spaces *> take_till is_newline <* newline)
          (many parse_paragraph)
      in
      
      (* Multi-paragraph footnote parsing *)
      let parse_footnote_multi =
        lift2
          (fun title content -> FootnoteMulti (title, content))
          (string "^^" *> spaces *> take_till is_newline <* newline)
          (many parse_paragraph <* string "^^")
      in
      
      (* Code block parsing *)
      let parse_code_block =
        lift2
          (fun lang code -> CodeBlock (if lang = "" then None else Some lang, code))
          (string "@code" *> option "" (spaces *> take_till is_newline) <* newline)
          (take_till (fun s -> s = '@') <* string "@end")
      in
      
      (* Horizontal rule parsing *)
      let parse_horizontal_rule =
        string "___" *> skip_while ((=) '_') *> newline *> return HorizontalRule
      in
      
      (* Todo status extension parsing *)
      let parse_todo_status =
        choice [
          string "( )" *> return (TodoStatus Undone);
          string "(x)" *> return (TodoStatus Done);
          string "(?)" *> return (TodoStatus NeedsInput);
          string "(!)" *> return (TodoStatus Urgent);
          string "(+)" *> take_till ((=) ')') *> char ')' *> return (TodoStatus (Recurring None));
          string "(-)" *> return (TodoStatus InProgress);
          string "(=)" *> return (TodoStatus OnHold);
          string "(_)" *> return (TodoStatus Cancelled);
        ] >>| fun status -> DetachedModifierExtension status
      in
      
      (* Todo priority extension parsing *)
      let parse_priority =
        string "(#" *> take_while1 (fun c -> c <> ')' && c <> '|') <* char ')' >>| fun p -> 
          DetachedModifierExtension (Priority p)
      in
      
      (* Parse extension with timestamp *)
      let parse_timestamp_extension prefix =
        string prefix *> take_till ((=) ')') <* char ')' >>| fun date ->
          match prefix with
          | "(<" -> DetachedModifierExtension (DueDate date)
          | "(>" -> DetachedModifierExtension (StartDate date)
          | "(@" -> DetachedModifierExtension (Timestamp date)
          | _ -> failwith "Invalid timestamp prefix"
      in
      
      (* Tag parsing *)
      let parse_tag =
        choice [
          (* Macro tag *)
          lift3
            (fun name params content -> Tag (RangedTag (MacroTag (name, params, content))))
            (char '=' *> take_while1 (fun c -> not (is_whitespace c || is_newline c)))
            (many (required_whitespace *> take_while1 (fun c -> not (is_whitespace c || is_newline c))))
            (newline *> take_till (fun s -> s = '=') <* string "=end")
          ;
          
          (* Standard tag *)
          lift3
            (fun name params blocks -> Tag (RangedTag (StandardTag (name, params, blocks))))
            (char '|' *> take_while1 (fun c -> not (is_whitespace c || is_newline c)))
            (many (required_whitespace *> take_while1 (fun c -> not (is_whitespace c || is_newline c))))
            (newline *> many parse_paragraph <* string "|end")
          ;
          
          (* Verbatim tag *)
          lift3
            (fun name params content -> Tag (RangedTag (VerbatimTag (name, params, content))))
            (char '@' *> take_while1 (fun c -> not (is_whitespace c || is_newline c)))
            (many (required_whitespace *> take_while1 (fun c -> not (is_whitespace c || is_newline c))))
            (newline *> take_till (fun s -> s = '@') <* string "@end")
          ;
          
          (* Strong carryover tag *)
          lift3
            (fun name params block -> Tag (CarryoverTag (Strong (name, params, block))))
            (char '#' *> take_while1 (fun c -> not (is_whitespace c || is_newline c)))
            (many (required_whitespace *> take_while1 (fun c -> not (is_whitespace c || is_newline c))))
            (newline *> parse_paragraph)
          ;
          
          (* Weak carryover tag *)
          lift3
            (fun name params block -> Tag (CarryoverTag (Weak (name, params, block))))
            (char '+' *> take_while1 (fun c -> not (is_whitespace c || is_newline c)))
            (many (required_whitespace *> take_while1 (fun c -> not (is_whitespace c || is_newline c))))
            (newline *> parse_paragraph)
          ;
          
          (* Infirm tag *)
          lift2
            (fun name params -> Tag (InfirmTag (name, params)))
            (char '.' *> take_while1 (fun c -> not (is_whitespace c || is_newline c)))
            (many (required_whitespace *> take_while1 (fun c -> not (is_whitespace c || is_newline c))))
        ]
      in
      
      (* Parse a document block *)
      let parse_block =
        choice [
          parse_heading;
          parse_unordered_list;
          parse_ordered_list;
          parse_quote;
          parse_definition_multi;
          parse_definition;
          parse_footnote_multi;
          parse_footnote;
          parse_code_block;
          parse_horizontal_rule;
          parse_todo_status;
          parse_priority;
          parse_timestamp_extension "(<";
          parse_timestamp_extension "(>";
          parse_timestamp_extension "(@";
          parse_tag;
          parse_paragraph;
        ]
      in
      
      (* Parse a complete document *)
      many (whitespace *> parse_block <* many newline)
    )
  
  (* Main parsing function *)
  let parse input =
    match parse_string ~consume:Prefix parse_document input with
    | Ok result -> result
    | Error msg -> failwith ("Parsing error: " ^ msg)
end

module Renderer = struct
  open Ast
  
  (* Convert an AST to Markdown *)
  let rec markdown_of_inline = function
    | Text s -> s
    | Bold inlines -> "**" ^ (markdown_of_inlines inlines) ^ "**"
    | Italic inlines -> "*" ^ (markdown_of_inlines inlines) ^ "*"
    | Underline inlines -> "_" ^ (markdown_of_inlines inlines) ^ "_"
    | Strikethrough inlines -> "~~" ^ (markdown_of_inlines inlines) ^ "~~"
    | Spoiler inlines -> "||" ^ (markdown_of_inlines inlines) ^ "||"
    | InlineCode s -> "`" ^ s ^ "`"
    | Superscript inlines -> "<sup>" ^ (markdown_of_inlines inlines) ^ "</sup>"
    | Subscript inlines -> "<sub>" ^ (markdown_of_inlines inlines) ^ "</sub>"
    | Math s -> "$" ^ s ^ "$"
    | Variable s -> s (* Variables aren't standardized in Markdown *)
    | InlineComment _ -> "" (* Comments aren't shown in rendered output *)
    | Link link_type -> markdown_of_link link_type
    | Anchor anchor_type -> markdown_of_anchor anchor_type
    | InlineLinkTarget s -> s
  
  and markdown_of_inlines inlines =
    String.concat "" (List.map markdown_of_inline inlines)
  
  and markdown_of_link = function
    | LinkLocation (loc, None) -> markdown_of_link_location loc
    | LinkLocation (loc, Some desc) -> "[" ^ markdown_of_inlines desc ^ "](" ^ markdown_of_link_location loc ^ ")"
    | InlineLink s -> s
  
  and markdown_of_link_location = function
    | Heading (_, s) -> "#" ^ (String.lowercase_ascii s)
    | Definition s -> "#" ^ (String.lowercase_ascii s)
    | Footnote s -> "#fn-" ^ (String.lowercase_ascii s)
    | FilePath (path, _) -> path
    | LineNumber n -> "#L" ^ string_of_int n
    | Url s -> s
    | FileLink (path, None) -> path
    | FileLink (path, Some line) -> path ^ "#L" ^ string_of_int line
    | MagicLink s -> "#" ^ (String.lowercase_ascii s)
    | TimestampLink s -> s
    | WikiLink s -> s
    | ExtendableLink s -> s
  
  and markdown_of_anchor = function
    | AnchorDeclaration s -> s
    | AnchorDefinition (s, loc) -> "[" ^ s ^ "](" ^ markdown_of_link_location loc ^ ")"
  
  let rec markdown_of_block ?(indent=0) = function
    | Paragraph inlines -> String.make indent ' ' ^ markdown_of_inlines inlines
    | Heading (level, title, blocks) ->
        String.make level '#' ^ " " ^ title ^ "\n\n" ^ 
        String.concat "\n\n" (List.map (markdown_of_block ~indent:indent) blocks)
    | UnorderedList (level, blocks) ->
        String.concat "\n" (List.map (fun block ->
          String.make (indent + (level - 1) * 2) ' ' ^ "- " ^ markdown_of_block ~indent:(indent + level * 2) block
        ) blocks)
    | OrderedList (level, blocks) ->
        let rec number_items items n =
          match items with
          | [] -> []
          | item :: rest -> 
            (String.make (indent + (level - 1) * 2) ' ' ^ string_of_int n ^ ". " ^ 
             markdown_of_block ~indent:(indent + level * 2) item) :: 
            number_items rest (n + 1)
        in
        String.concat "\n" (number_items blocks 1)
    | Quote (level, blocks) ->
        String.concat "\n" (List.map (fun block ->
          String.make level '>' ^ " " ^ markdown_of_block ~indent:indent block
        ) blocks)
    | Definition (title, blocks) ->
        String.make indent ' ' ^ "**" ^ title ^ "**: " ^ 
        String.concat "\n" (List.map (markdown_of_block ~indent:(indent + 2)) blocks)
    | DefinitionMulti (title, blocks) ->
        String.make indent ' ' ^ "**" ^ title ^ "**:\n" ^ 
        String.concat "\n\n" (List.map (markdown_of_block ~indent:(indent + 2)) blocks)
    | Footnote (title, blocks) ->
        String.make indent ' ' ^ "[^" ^ title ^ "]: " ^ 
        String.concat "\n" (List.map (markdown_of_block ~indent:(indent + 4)) blocks)
    | FootnoteMulti (title, blocks) ->
        String.make indent ' ' ^ "[^" ^ title ^ "]: " ^ 
        String.concat "\n\n" (List.map (markdown_of_block ~indent:(indent + 4)) blocks)
    | CodeBlock (None, code) ->
        String.make indent ' ' ^ "```\n" ^ code ^ "\n```"
    | CodeBlock (Some lang, code) ->
        String.make indent ' ' ^ "```" ^ lang ^ "\n" ^ code ^ "\n```"
    | Table _ -> String.make indent ' ' ^ "<!-- Table not supported in this renderer -->"
    | HorizontalRule -> String.make indent ' ' ^ "---"
    | DetachedModifierExtension ext -> markdown_of_extension ~indent ext
    | Tag tag -> markdown_of_tag ~indent tag
  
  and markdown_of_extension ~indent = function
    | TodoStatus status -> 
        String.make indent ' ' ^ (match status with
          | Undone -> "[ ]"
          | Done -> "[x]"
          | NeedsInput -> "[?]"
          | Urgent -> "[!]"
          | Recurring _ -> "[+]"
          | InProgress -> "[-]"
          | OnHold -> "[=]"
          | Cancelled -> "[_]"
        )
    | Priority p -> String.make indent ' ' ^ "[Priority: " ^ p ^ "]"
    | DueDate d -> String.make indent ' ' ^ "[Due: " ^ d ^ "]"
    | StartDate d -> String.make indent ' ' ^ "[Start: " ^ d ^ "]"
    | Timestamp d -> String.make indent ' ' ^ "[Date: " ^ d ^ "]"
  
  and markdown_of_tag ~indent = function
    | RangedTag (MacroTag (_, _, _)) -> String.make indent ' ' ^ "<!-- Macro tag -->"
    | RangedTag (StandardTag ("comment", _, _)) -> ""
    | RangedTag (StandardTag ("example", _, blocks)) -> 
        String.concat "\n\n" (List.map (markdown_of_block ~indent) blocks)
    | RangedTag (StandardTag ("details", _, blocks)) ->
        String.make indent ' ' ^ "<details>\n" ^ 
        String.concat "\n\n" (List.map (markdown_of_block ~indent:(indent + 2)) blocks) ^
        "\n" ^ String.make indent ' ' ^ "</details>"
    | RangedTag (StandardTag (name, _, blocks)) ->
        String.make indent ' ' ^ "<!-- " ^ name ^ " start -->\n" ^
        String.concat "\n\n" (List.map (markdown_of_block ~indent) blocks) ^
        "\n" ^ String.make indent ' ' ^ "<!-- " ^ name ^ " end -->"
    | RangedTag (VerbatimTag ("code", [lang], code)) ->
        String.make indent ' ' ^ "```" ^ lang ^ "\n" ^ code ^ "\n" ^ String.make indent ' ' ^ "```" 
    | RangedTag (VerbatimTag ("code", [], code)) ->
        String.make indent ' ' ^ "```\n" ^ code ^ "\n" ^ String.make indent ' ' ^ "```"
    | RangedTag (VerbatimTag ("image", params, _)) ->
        String.make indent ' ' ^ "![" ^ (String.concat " " params) ^ "](image)"
    | RangedTag (VerbatimTag ("math", _, content)) ->
        String.make indent ' ' ^ "$$\n" ^ content ^ "\n$$"
    | RangedTag (VerbatimTag (name, _, _)) ->
        String.make indent ' ' ^ "<!-- " ^ name ^ " verbatim tag -->"
    | CarryoverTag (Strong (name, params, block)) ->
        markdown_of_block ~indent block ^ 
        " <!-- Strong carryover tag: " ^ name ^ " " ^ String.concat " " params ^ " -->"
    | CarryoverTag (Weak (name, params, block)) ->
        markdown_of_block ~indent block ^ 
        " <!-- Weak carryover tag: " ^ name ^ " " ^ String.concat " " params ^ " -->"
    | InfirmTag (name, params) ->
        String.make indent ' ' ^ "<!-- Infirm tag: " ^ name ^ " " ^ String.concat " " params ^ " -->"
  
  let to_markdown blocks =
    String.concat "\n\n" (List.map (markdown_of_block ~indent:0) blocks)
  
  (* Convert an AST to HTML *)
  let rec html_of_inline = function
    | Text s -> s
    | Bold inlines -> "<strong>" ^ (html_of_inlines inlines) ^ "</strong>"
    | Italic inlines -> "<em>" ^ (html_of_inlines inlines) ^ "</em>"
    | Underline inlines -> "<u>" ^ (html_of_inlines inlines) ^ "</u>"
    | Strikethrough inlines -> "<del>" ^ (html_of_inlines inlines) ^ "</del>"
    | Spoiler inlines -> "<span class=\"spoiler\">" ^ (html_of_inlines inlines) ^ "</span>"
    | InlineCode s -> "<code>" ^ s ^ "</code>"
    | Superscript inlines -> "<sup>" ^ (html_of_inlines inlines) ^ "</sup>"
    | Subscript inlines -> "<sub>" ^ (html_of_inlines inlines) ^ "</sub>"
    | Math s -> "<span class=\"math\">\\(" ^ s ^ "\\)</span>"
    | Variable s -> s
    | InlineComment _ -> ""
    | Link link_type -> html_of_link link_type
    | Anchor anchor_type -> html_of_anchor anchor_type
    | InlineLinkTarget s -> "<span id=\"" ^ s ^ "\">" ^ s ^ "</span>"
  
  and html_of_inlines inlines =
    String.concat "" (List.map html_of_inline inlines)
  
  and html_of_link = function
    | LinkLocation (loc, None) -> "<a href=\"" ^ html_of_link_location loc ^ "\">" ^ html_of_link_location loc ^ "</a>"
    | LinkLocation (loc, Some desc) -> "<a href=\"" ^ html_of_link_location loc ^ "\">" ^ html_of_inlines desc ^ "</a>"
    | InlineLink s -> "<span id=\"" ^ s ^ "\">" ^ s ^ "</span>"
  
  and html_of_link_location = function
    | Heading (_, s) -> "#" ^ (String.lowercase_ascii s)
    | Definition s -> "#" ^ (String.lowercase_ascii s)
    | Footnote s -> "#fn-" ^ (String.lowercase_ascii s)
    | FilePath (path, _) -> path
    | LineNumber n -> "#L" ^ string_of_int n
    | Url s -> s
    | FileLink (path, None) -> path
    | FileLink (path, Some line) -> path ^ "#L" ^ string_of_int line
    | MagicLink s -> "#" ^ (String.lowercase_ascii s)
    | TimestampLink s -> s
    | WikiLink s -> s
    | ExtendableLink s -> s
  
  and html_of_anchor = function
    | AnchorDeclaration s -> s
    | AnchorDefinition (s, loc) -> "<a href=\"" ^ html_of_link_location loc ^ "\">" ^ s ^ "</a>"
  
  let rec html_of_block = function
    | Paragraph inlines -> "<p>" ^ html_of_inlines inlines ^ "</p>"
    | Heading (level, title, blocks) ->
        let h_tag = "h" ^ string_of_int (min level 6) in
        "<" ^ h_tag ^ " id=\"" ^ String.lowercase_ascii title ^ "\">" ^ title ^ "</" ^ h_tag ^ ">" ^
        String.concat "" (List.map html_of_block blocks)
    | UnorderedList (_, blocks) ->
        "<ul>" ^ 
        String.concat "" (List.map (fun block -> "<li>" ^ html_of_block block ^ "</li>") blocks) ^
        "</ul>"
    | OrderedList (_, blocks) ->
        "<ol>" ^ 
        String.concat "" (List.map (fun block -> "<li>" ^ html_of_block block ^ "</li>") blocks) ^
        "</ol>"
    | Quote (_, blocks) ->
        "<blockquote>" ^ 
        String.concat "" (List.map html_of_block blocks) ^
        "</blockquote>"
    | Definition (title, blocks) ->
        "<dl><dt id=\"" ^ String.lowercase_ascii title ^ "\">" ^ title ^ "</dt><dd>" ^ 
        String.concat "" (List.map html_of_block blocks) ^
        "</dd></dl>"
    | DefinitionMulti (title, blocks) ->
        "<dl><dt id=\"" ^ String.lowercase_ascii title ^ "\">" ^ title ^ "</dt><dd>" ^ 
        String.concat "" (List.map html_of_block blocks) ^
        "</dd></dl>"
    | Footnote (title, blocks) ->
        "<div class=\"footnote\" id=\"fn-" ^ String.lowercase_ascii title ^ "\"><sup>" ^ title ^ "</sup> " ^ 
        String.concat "" (List.map html_of_block blocks) ^
        "</div>"
    | FootnoteMulti (title, blocks) ->
        "<div class=\"footnote\" id=\"fn-" ^ String.lowercase_ascii title ^ "\"><sup>" ^ title ^ "</sup> " ^ 
        String.concat "" (List.map html_of_block blocks) ^
        "</div>"
    | CodeBlock (None, code) ->
        "<pre><code>" ^ code ^ "</code></pre>"
    | CodeBlock (Some lang, code) ->
        "<pre><code class=\"language-" ^ lang ^ "\">" ^ code ^ "</code></pre>"
    | Table _ -> "<div><!-- Table not supported in this renderer --></div>"
    | HorizontalRule -> "<hr>"
    | DetachedModifierExtension ext -> html_of_extension ext
    | Tag tag -> html_of_tag tag
  
  and html_of_extension = function
    | TodoStatus status -> 
        (match status with
          | Undone -> "<input type=\"checkbox\">"
          | Done -> "<input type=\"checkbox\" checked>"
          | NeedsInput -> "<input type=\"checkbox\" class=\"needs-input\">"
          | Urgent -> "<input type=\"checkbox\" class=\"urgent\">"
          | Recurring _ -> "<input type=\"checkbox\" class=\"recurring\">"
          | InProgress -> "<input type=\"checkbox\" class=\"in-progress\">"
          | OnHold -> "<input type=\"checkbox\" class=\"on-hold\">"
          | Cancelled -> "<input type=\"checkbox\" class=\"cancelled\">"
        )
    | Priority p -> "<span class=\"priority\">" ^ p ^ "</span>"
    | DueDate d -> "<span class=\"due-date\">" ^ d ^ "</span>"
    | StartDate d -> "<span class=\"start-date\">" ^ d ^ "</span>"
    | Timestamp d -> "<span class=\"timestamp\">" ^ d ^ "</span>"
  
  and html_of_tag = function
    | RangedTag (MacroTag (_, _, _)) -> "<!-- Macro tag -->"
    | RangedTag (StandardTag ("comment", _, _)) -> ""
    | RangedTag (StandardTag ("example", _, blocks)) -> 
        "<div class=\"example\">" ^
        String.concat "" (List.map html_of_block blocks) ^
        "</div>"
    | RangedTag (StandardTag ("details", _, blocks)) ->
        "<details><summary>Details</summary>" ^ 
        String.concat "" (List.map html_of_block blocks) ^
        "</details>"
    | RangedTag (StandardTag (name, _, blocks)) ->
        "<div class=\"" ^ name ^ "\">" ^
        String.concat "" (List.map html_of_block blocks) ^
        "</div>"
    | RangedTag (VerbatimTag ("code", [lang], code)) ->
        "<pre><code class=\"language-" ^ lang ^ "\">" ^ code ^ "</code></pre>"
    | RangedTag (VerbatimTag ("code", [], code)) ->
        "<pre><code>" ^ code ^ "</code></pre>"
    | RangedTag (VerbatimTag ("image", params, content)) ->
        "<img src=\"" ^ content ^ "\" alt=\"" ^ String.concat " " params ^ "\">"
    | RangedTag (VerbatimTag ("math", _, content)) ->
        "<div class=\"math\">\\[" ^ content ^ "\\]</div>"
    | RangedTag (VerbatimTag (name, _, _)) ->
        "<!-- " ^ name ^ " verbatim tag -->"
    | CarryoverTag (Strong (name, params, block)) ->
        "<div class=\"" ^ name ^ " " ^ String.concat " " params ^ "\">" ^
        html_of_block block ^
        "</div>"
    | CarryoverTag (Weak (name, params, block)) ->
        "<span class=\"" ^ name ^ " " ^ String.concat " " params ^ "\">" ^
        html_of_block block ^
        "</span>"
    | InfirmTag (name, params) ->
        "<!-- Infirm tag: " ^ name ^ " " ^ String.concat " " params ^ " -->"
  
  let to_html blocks =
    "<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"UTF-8\">\n<title>Norg Document</title>\n<style>\n" ^
    "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; }\n" ^
    ".spoiler { background-color: black; color: black; }\n" ^
    ".spoiler:hover { color: white; }\n" ^
    "</style>\n</head>\n<body>\n" ^
    String.concat "\n" (List.map html_of_block blocks) ^
    "\n</body>\n</html>"
  
  (* Convert an AST to JSON *)
  let rec json_of_inline = function
    | Text s -> Printf.sprintf "{\"type\":\"text\",\"content\":\"%s\"}" (String.escaped s)
    | Bold inlines -> Printf.sprintf "{\"type\":\"bold\",\"content\":[%s]}" (json_of_inlines inlines)
    | Italic inlines -> Printf.sprintf "{\"type\":\"italic\",\"content\":[%s]}" (json_of_inlines inlines)
    | Underline inlines -> Printf.sprintf "{\"type\":\"underline\",\"content\":[%s]}" (json_of_inlines inlines)
    | Strikethrough inlines -> Printf.sprintf "{\"type\":\"strikethrough\",\"content\":[%s]}" (json_of_inlines inlines)
    | Spoiler inlines -> Printf.sprintf "{\"type\":\"spoiler\",\"content\":[%s]}" (json_of_inlines inlines)
    | InlineCode s -> Printf.sprintf "{\"type\":\"inlineCode\",\"content\":\"%s\"}" (String.escaped s)
    | Superscript inlines -> Printf.sprintf "{\"type\":\"superscript\",\"content\":[%s]}" (json_of_inlines inlines)
    | Subscript inlines -> Printf.sprintf "{\"type\":\"subscript\",\"content\":[%s]}" (json_of_inlines inlines)
    | Math s -> Printf.sprintf "{\"type\":\"math\",\"content\":\"%s\"}" (String.escaped s)
    | Variable s -> Printf.sprintf "{\"type\":\"variable\",\"content\":\"%s\"}" (String.escaped s)
    | InlineComment s -> Printf.sprintf "{\"type\":\"inlineComment\",\"content\":\"%s\"}" (String.escaped s)
    | Link link_type -> Printf.sprintf "{\"type\":\"link\",\"content\":%s}" (json_of_link link_type)
    | Anchor anchor_type -> Printf.sprintf "{\"type\":\"anchor\",\"content\":%s}" (json_of_anchor anchor_type)
    | InlineLinkTarget s -> Printf.sprintf "{\"type\":\"inlineLinkTarget\",\"content\":\"%s\"}" (String.escaped s)
  
  and json_of_inlines inlines =
    String.concat "," (List.map json_of_inline inlines)
  
  and json_of_link = function
    | LinkLocation (loc, None) -> 
        Printf.sprintf "{\"type\":\"linkLocation\",\"location\":%s}" (json_of_link_location loc)
    | LinkLocation (loc, Some desc) -> 
        Printf.sprintf "{\"type\":\"linkLocationWithDesc\",\"location\":%s,\"description\":[%s]}" 
          (json_of_link_location loc) (json_of_inlines desc)
    | InlineLink s -> 
        Printf.sprintf "{\"type\":\"inlineLink\",\"content\":\"%s\"}" (String.escaped s)
  
  and json_of_link_location = function
    | Heading (level, s) -> 
        Printf.sprintf "{\"type\":\"heading\",\"level\":%d,\"content\":\"%s\"}" level (String.escaped s)
    | Definition s -> 
        Printf.sprintf "{\"type\":\"definition\",\"content\":\"%s\"}" (String.escaped s)
    | Footnote s -> 
        Printf.sprintf "{\"type\":\"footnote\",\"content\":\"%s\"}" (String.escaped s)
    | FilePath (path, None) -> 
        Printf.sprintf "{\"type\":\"filePath\",\"path\":\"%s\"}" (String.escaped path)
    | FilePath (path, Some target) -> 
        Printf.sprintf "{\"type\":\"filePathWithTarget\",\"path\":\"%s\",\"target\":%s}" 
          (String.escaped path) (json_of_link_target target)
    | LineNumber n -> 
        Printf.sprintf "{\"type\":\"lineNumber\",\"line\":%d}" n
    | Url s -> 
        Printf.sprintf "{\"type\":\"url\",\"url\":\"%s\"}" (String.escaped s)
    | FileLink (path, None) -> 
        Printf.sprintf "{\"type\":\"fileLink\",\"path\":\"%s\"}" (String.escaped path)
    | FileLink (path, Some line) -> 
        Printf.sprintf "{\"type\":\"fileLinkWithLine\",\"path\":\"%s\",\"line\":%d}" (String.escaped path) line
    | MagicLink s -> 
        Printf.sprintf "{\"type\":\"magicLink\",\"content\":\"%s\"}" (String.escaped s)
    | TimestampLink s -> 
        Printf.sprintf "{\"type\":\"timestampLink\",\"content\":\"%s\"}" (String.escaped s)
    | WikiLink s -> 
        Printf.sprintf "{\"type\":\"wikiLink\",\"content\":\"%s\"}" (String.escaped s)
    | ExtendableLink s -> 
        Printf.sprintf "{\"type\":\"extendableLink\",\"content\":\"%s\"}" (String.escaped s)
  
  and json_of_link_target = function
    | HeadingTarget (level, s) -> 
        Printf.sprintf "{\"type\":\"headingTarget\",\"level\":%d,\"content\":\"%s\"}" level (String.escaped s)
    | DefinitionTarget s -> 
        Printf.sprintf "{\"type\":\"definitionTarget\",\"content\":\"%s\"}" (String.escaped s)
    | FootnoteTarget s -> 
        Printf.sprintf "{\"type\":\"footnoteTarget\",\"content\":\"%s\"}" (String.escaped s)
    | MagicTarget s -> 
        Printf.sprintf "{\"type\":\"magicTarget\",\"content\":\"%s\"}" (String.escaped s)
    | LineNumberTarget n -> 
        Printf.sprintf "{\"type\":\"lineNumberTarget\",\"line\":%d}" n
  
  and json_of_anchor = function
    | AnchorDeclaration s -> 
        Printf.sprintf "{\"type\":\"anchorDeclaration\",\"content\":\"%s\"}" (String.escaped s)
    | AnchorDefinition (s, loc) -> 
        Printf.sprintf "{\"type\":\"anchorDefinition\",\"content\":\"%s\",\"location\":%s}" 
          (String.escaped s) (json_of_link_location loc)
  
  let rec json_of_block = function
    | Paragraph inlines -> 
        Printf.sprintf "{\"type\":\"paragraph\",\"content\":[%s]}" (json_of_inlines inlines)
    | Heading (level, title, blocks) ->
        Printf.sprintf "{\"type\":\"heading\",\"level\":%d,\"title\":\"%s\",\"content\":[%s]}" 
          level (String.escaped title) (json_of_blocks blocks)
    | UnorderedList (level, blocks) ->
        Printf.sprintf "{\"type\":\"unorderedList\",\"level\":%d,\"content\":[%s]}" 
          level (json_of_blocks blocks)
    | OrderedList (level, blocks) ->
        Printf.sprintf "{\"type\":\"orderedList\",\"level\":%d,\"content\":[%s]}" 
          level (json_of_blocks blocks)
    | Quote (level, blocks) ->
        Printf.sprintf "{\"type\":\"quote\",\"level\":%d,\"content\":[%s]}" 
          level (json_of_blocks blocks)
    | Definition (title, blocks) ->
        Printf.sprintf "{\"type\":\"definition\",\"title\":\"%s\",\"content\":[%s]}" 
          (String.escaped title) (json_of_blocks blocks)
    | DefinitionMulti (title, blocks) ->
        Printf.sprintf "{\"type\":\"definitionMulti\",\"title\":\"%s\",\"content\":[%s]}" 
          (String.escaped title) (json_of_blocks blocks)
    | Footnote (title, blocks) ->
        Printf.sprintf "{\"type\":\"footnote\",\"title\":\"%s\",\"content\":[%s]}" 
          (String.escaped title) (json_of_blocks blocks)
    | FootnoteMulti (title, blocks) ->
        Printf.sprintf "{\"type\":\"footnoteMulti\",\"title\":\"%s\",\"content\":[%s]}" 
          (String.escaped title) (json_of_blocks blocks)
    | CodeBlock (None, code) ->
        Printf.sprintf "{\"type\":\"codeBlock\",\"language\":null,\"content\":\"%s\"}" 
          (String.escaped code)
    | CodeBlock (Some lang, code) ->
        Printf.sprintf "{\"type\":\"codeBlock\",\"language\":\"%s\",\"content\":\"%s\"}" 
          (String.escaped lang) (String.escaped code)
    | Table _ -> 
        "{\"type\":\"table\",\"content\":\"Not implemented\"}"
    | HorizontalRule -> 
        "{\"type\":\"horizontalRule\"}"
    | DetachedModifierExtension ext -> 
        Printf.sprintf "{\"type\":\"detachedModifierExtension\",\"content\":%s}" (json_of_extension ext)
    | Tag tag -> 
        Printf.sprintf "{\"type\":\"tag\",\"content\":%s}" (json_of_tag tag)
  
  and json_of_blocks blocks =
    String.concat "," (List.map json_of_block blocks)
  
  and json_of_extension = function
    | TodoStatus status -> 
        let status_str = match status with
          | Undone -> "undone"
          | Done -> "done"
          | NeedsInput -> "needsInput"
          | Urgent -> "urgent"
          | Recurring None -> "recurring"
          | Recurring (Some date) -> Printf.sprintf "recurring:%s" date
          | InProgress -> "inProgress"
          | OnHold -> "onHold"
          | Cancelled -> "cancelled"
        in
        Printf.sprintf "{\"type\":\"todoStatus\",\"status\":\"%s\"}" status_str
    | Priority p -> 
        Printf.sprintf "{\"type\":\"priority\",\"priority\":\"%s\"}" (String.escaped p)
    | DueDate d -> 
        Printf.sprintf "{\"type\":\"dueDate\",\"date\":\"%s\"}" (String.escaped d)
    | StartDate d -> 
        Printf.sprintf "{\"type\":\"startDate\",\"date\":\"%s\"}" (String.escaped d)
    | Timestamp d -> 
        Printf.sprintf "{\"type\":\"timestamp\",\"date\":\"%s\"}" (String.escaped d)
  
  and json_of_tag = function
    | RangedTag (MacroTag (name, params, content)) -> 
        Printf.sprintf "{\"type\":\"macroTag\",\"name\":\"%s\",\"params\":[%s],\"content\":\"%s\"}" 
          (String.escaped name) 
          (String.concat "," (List.map (fun p -> "\"" ^ String.escaped p ^ "\"") params))
          (String.escaped content)
    | RangedTag (StandardTag (name, params, blocks)) -> 
        Printf.sprintf "{\"type\":\"standardTag\",\"name\":\"%s\",\"params\":[%s],\"content\":[%s]}" 
          (String.escaped name) 
          (String.concat "," (List.map (fun p -> "\"" ^ String.escaped p ^ "\"") params))
          (json_of_blocks blocks)
    | RangedTag (VerbatimTag (name, params, content)) -> 
        Printf.sprintf "{\"type\":\"verbatimTag\",\"name\":\"%s\",\"params\":[%s],\"content\":\"%s\"}" 
          (String.escaped name) 
          (String.concat "," (List.map (fun p -> "\"" ^ String.escaped p ^ "\"") params))
          (String.escaped content)
    | CarryoverTag (Strong (name, params, block)) -> 
        Printf.sprintf "{\"type\":\"strongCarryoverTag\",\"name\":\"%s\",\"params\":[%s],\"content\":%s}" 
          (String.escaped name) 
          (String.concat "," (List.map (fun p -> "\"" ^ String.escaped p ^ "\"") params))
          (json_of_block block)
    | CarryoverTag (Weak (name, params, block)) -> 
        Printf.sprintf "{\"type\":\"weakCarryoverTag\",\"name\":\"%s\",\"params\":[%s],\"content\":%s}" 
          (String.escaped name) 
          (String.concat "," (List.map (fun p -> "\"" ^ String.escaped p ^ "\"") params))
          (json_of_block block)
    | InfirmTag (name, params) -> 
        Printf.sprintf "{\"type\":\"infirmTag\",\"name\":\"%s\",\"params\":[%s]}" 
          (String.escaped name) 
          (String.concat "," (List.map (fun p -> "\"" ^ String.escaped p ^ "\"") params))
  
  let to_json blocks =
    Printf.sprintf "{\n  \"type\": \"document\",\n  \"content\": [\n    %s\n  ]\n}" 
      (String.concat ",\n    " (List.map json_of_block blocks))
end

(* Main module interface *)
let parse = Parser.parse
let to_markdown = Renderer.to_markdown
let to_html = Renderer.to_html
let to_json = Renderer.to_json
