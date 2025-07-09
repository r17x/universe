module Ast = struct
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
	
	and anchor =
		| AnchorDeclaration of string
		| AnchorDefinition of string * link_location
	
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
	
	and extension =
		| TodoStatus of todo_status
		| Priority of string
		| DueDate of string
		| StartDate of string
		| Timestamp of string
	
	and todo_status =
		| Undone
		| Done
		| NeedsInput
		| Urgent
		| Recurring of string option
		| InProgress
		| OnHold
		| Cancelled
	
	and table = {
		headers: string list option;
		rows: string list list;
	}
	
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
	
	type document = block list
end

module Parser = struct
	open Angstrom
	open Ast

	let is_whitespace = function
		| ' ' | '\t' | '\r' -> true
		| _ -> false
	
	let is_newline = function
		| '\n' -> true
		| _ -> false
	
	let is_special_char = function
		| '*' | '/' | '_' | '-' | '!' | '`' | '^' | ',' 
		| '$' | '&' | '%' | '#' | '+' | '@' | '|' 
		| '=' | '{' | '}' | '[' | ']' | '<' | '>' | '\\' -> true
		| _ -> false
	
	let not_special_char c = not (is_special_char c)
	
	let whitespace = take_while is_whitespace
	let required_whitespace = take_while1 is_whitespace
	let newline = char '\n'
	let spaces = skip_while is_whitespace
	let _spaces1 = skip_many1 (satisfy is_whitespace)
  
	let text = take_while1 not_special_char >>| fun s -> Text s
	
	let escaped_char = char '\\' *> any_char >>| fun c -> Text (String.make 1 c)
	
	let parse_inline_element open_char close_char constructor content_parser =
		char open_char *> 
		content_parser <* 
		char close_char >>| constructor
	
	let parse_freeform_inline open_char close_char constructor =
		string (open_char ^ "|") *>
		take_till (fun c -> c = '|') <*
		string ("|" ^ close_char) >>|
		fun content -> constructor [Text content]
  
	let parse_inline_content = 
		fix (fun parse_inline_content ->
		
		let parse_bold =
			parse_inline_element '*' '*' (fun content -> Bold [Text content]) (take_till ((=) '*'))
			<|> parse_freeform_inline "*" "*" (fun x -> Bold x)
		in
		
		let parse_italic =
			parse_inline_element '/' '/' (fun content -> Italic [Text content]) (take_till ((=) '/'))
			<|> parse_freeform_inline "/" "/" (fun x -> Italic x)
		in
		
		let parse_underline =
			parse_inline_element '_' '_' (fun content -> Underline [Text content]) (take_till ((=) '_'))
			<|> parse_freeform_inline "_" "_" (fun x -> Underline x)
		in
		
		let parse_strikethrough =
			parse_inline_element '-' '-' (fun content -> Strikethrough [Text content]) (take_till ((=) '-'))
			<|> parse_freeform_inline "-" "-" (fun x -> Strikethrough x)
		in
		
		let parse_spoiler =
			parse_inline_element '!' '!' (fun content -> Spoiler [Text content]) (take_till ((=) '!'))
			<|> parse_freeform_inline "!" "!" (fun x -> Spoiler x)
		in
		
		let parse_inline_code =
			parse_inline_element '`' '`' (fun content -> InlineCode content) (take_till ((=) '`'))
			<|> parse_freeform_inline "`" "`" (fun _ -> InlineCode "")
		in
		
		let parse_superscript =
			parse_inline_element '^' '^' (fun content -> Superscript [Text content]) (take_till ((=) '^'))
			<|> parse_freeform_inline "^" "^" (fun x -> Superscript x)
		in
		
		let parse_subscript =
			parse_inline_element ',' ',' (fun content -> Subscript [Text content]) 
				(take_while1 (fun c -> c != ',' && c != '.' && c != '\n' && c != '/' && c != '*' && c != '_'))
			<|> parse_freeform_inline "," "," (fun x -> Subscript x)
		in
		
		let parse_math =
			parse_inline_element '$' '$' (fun content -> Math content) (take_till ((=) '$'))
			<|> parse_freeform_inline "$" "$" (fun _ -> Math "")
		in
		
		let parse_variable =
			parse_inline_element '&' '&' (fun content -> Variable content) (take_till ((=) '&'))
			<|> parse_freeform_inline "&" "&" (fun _ -> Variable "")
		in
		
		let parse_inline_comment =
			parse_inline_element '%' '%' (fun content -> InlineComment content) (take_till ((=) '%'))
			<|> parse_freeform_inline "%" "%" (fun _ -> InlineComment "")
		in
    
		let parse_heading_target =
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
				(fun level title -> (Heading (level, String.trim title) : link_location))
				(char '*' *> many (char '*') >>| (fun stars -> 1 + List.length stars))
				(required_whitespace *> take_till ((=) '}'))
		in
		
		let parse_definition_link =
			char '$' *> required_whitespace *> take_till ((=) '}') >>| fun title ->
				(Definition (String.trim title) : link_location)
		in
		
		let parse_footnote_link =
			char '^' *> required_whitespace *> take_till ((=) '}') >>| fun title ->
				(Footnote (String.trim title) : link_location)
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
		
		let single_char_as_text =
			any_char >>| fun c -> Text (String.make 1 c)
		in
		
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
				single_char_as_text;
			]
		in
		
		many1 parse_inline_element_choice
	)
  
	let parse_paragraph =
		let rec parse_lines acc =
			take_till is_newline >>= fun line ->
			let trimmed = String.trim line in
			if trimmed = "" then
				if acc = [] then fail "Empty paragraph"
				else return (String.concat " " (List.rev acc))
			else
				option () (newline >>| fun _ -> ()) *> 
				(peek_char >>= function
					| Some c when c = '*' || c = '-' || c = '~' || c = '>' || c = '$' || c = '^' || c = '@' || c = '|' || c = '=' ->
						return (String.concat " " (List.rev (trimmed :: acc)))
					| None ->
						return (String.concat " " (List.rev (trimmed :: acc)))
					| Some _ ->
						whitespace *> parse_lines (trimmed :: acc)
				)
		in
		parse_lines [] >>= fun content -> 
		match parse_string ~consume:Prefix parse_inline_content content with
		| Ok inlines -> return (Paragraph inlines)
		| Error _ -> return (Paragraph [Text content])
  
	let parse_document =
		fix (fun _parse_document ->
			let parse_heading =
				lift2 
					(fun level title -> Heading (level, title, []))
					(char '*' *> many (char '*') <* spaces >>| (fun stars -> 1 + List.length stars))
					(take_till is_newline)
			in
      
			let parse_unordered_list =
				lift2
					(fun level content -> UnorderedList (level, content))
					(char '-' *> many (char '-') <* spaces >>| (fun dashes -> 1 + List.length dashes))
					(parse_paragraph >>= fun p -> 
						 many (parse_paragraph) >>| fun ps -> p :: ps)
			in
			
			let parse_ordered_list =
				lift2
					(fun level content -> OrderedList (level, content))
					(char '~' *> many (char '~') <* spaces >>| (fun tildes -> 1 + List.length tildes))
					(parse_paragraph >>= fun p -> 
						 many (parse_paragraph) >>| fun ps -> p :: ps)
			in
			
			let parse_quote =
				lift2
					(fun level content -> Quote (level, content))
					(char '>' *> many (char '>') <* spaces >>| (fun quotes -> 1 + List.length quotes))
					(parse_paragraph >>= fun p -> 
						 many (parse_paragraph) >>| fun ps -> p :: ps)
			in
			
			let parse_definition =
				lift2
					(fun title content -> Definition (title, content))
					(char '$' *> spaces *> take_till is_newline <* newline)
					(many parse_paragraph)
			in
			
			let parse_definition_multi =
				lift2
					(fun title content -> DefinitionMulti (title, content))
					(string "$$" *> spaces *> take_till is_newline <* newline)
					(many parse_paragraph <* string "$$")
			in
			
			let parse_footnote =
				lift2
					(fun title content -> Footnote (title, content))
					(char '^' *> spaces *> take_till is_newline <* newline)
					(many parse_paragraph)
			in
			
			let parse_footnote_multi =
				lift2
					(fun title content -> FootnoteMulti (title, content))
					(string "^^" *> spaces *> take_till is_newline <* newline)
					(many parse_paragraph <* string "^^")
			in
			
			let parse_code_block =
				lift2
					(fun lang code -> CodeBlock ((if lang = "" then None else Some lang), code))
					(string "@code" *> option "" (spaces *> take_till is_newline) <* newline)
					(take_till (fun s -> s = '@') <* string "@end")
			in
			
			let parse_horizontal_rule =
				string "___" *> skip_while ((=) '_') *> newline *> return HorizontalRule
			in
      
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
			
			let parse_priority =
				string "(#" *> take_while1 (fun c -> c <> ')' && c <> '|') <* char ')' >>| fun p -> 
					DetachedModifierExtension (Priority p)
			in
			
			let parse_timestamp_extension prefix =
				string prefix *> take_till ((=) ')') <* char ')' >>| fun date ->
					match prefix with
					| "(<" -> DetachedModifierExtension (DueDate date)
					| "(>" -> DetachedModifierExtension (StartDate date)
					| "(@" -> DetachedModifierExtension (Timestamp date)
					| _ -> failwith "Invalid timestamp prefix"
			in
      
			let parse_tag =
				choice [
					lift3
						(fun name params content -> Tag (RangedTag (MacroTag (name, params, content))))
						(char '=' *> take_while1 (fun c -> not (is_whitespace c || is_newline c)))
						(many (required_whitespace *> take_while1 (fun c -> not (is_whitespace c || is_newline c))))
						(newline *> take_till (fun s -> s = '=') <* string "=end")
				;
				
					lift3
						(fun name params blocks -> Tag (RangedTag (StandardTag (name, params, blocks))))
						(char '|' *> take_while1 (fun c -> not (is_whitespace c || is_newline c)))
						(many (required_whitespace *> take_while1 (fun c -> not (is_whitespace c || is_newline c))))
						(newline *> many parse_paragraph <* string "|end")
				;
				
					lift3
						(fun name params content -> Tag (RangedTag (VerbatimTag (name, params, content))))
						(char '@' *> take_while1 (fun c -> not (is_whitespace c || is_newline c)))
						(many (required_whitespace *> take_while1 (fun c -> not (is_whitespace c || is_newline c))))
						(newline *> take_till (fun s -> s = '@') <* string "@end")
				;
				
					lift3
						(fun name params block -> Tag (CarryoverTag (Strong (name, params, block))))
						(char '#' *> take_while1 (fun c -> not (is_whitespace c || is_newline c)))
						(many (required_whitespace *> take_while1 (fun c -> not (is_whitespace c || is_newline c))))
						(newline *> parse_paragraph)
				;
				
					lift3
						(fun name params block -> Tag (CarryoverTag (Weak (name, params, block))))
						(char '+' *> take_while1 (fun c -> not (is_whitespace c || is_newline c)))
						(many (required_whitespace *> take_while1 (fun c -> not (is_whitespace c || is_newline c))))
						(newline *> parse_paragraph)
				;
				
					lift2
						(fun name params -> Tag (InfirmTag (name, params)))
						(char '.' *> take_while1 (fun c -> not (is_whitespace c || is_newline c)))
						(many (required_whitespace *> take_while1 (fun c -> not (is_whitespace c || is_newline c))))
				]
			in
      
			
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
			
			let rec parse_blocks acc =
				whitespace *> 
				(parse_block >>= fun block ->
					 many newline *> parse_blocks (block :: acc)
				) <|> return (List.rev acc)
			in
			parse_blocks []
		)
  
	let parse input =
		match parse_string ~consume:Prefix parse_document input with
		| Ok result -> result
		| Error msg -> failwith ("Parsing error: " ^ msg)
end

module Renderer = struct
	open Ast
	
	module Markdown = struct
		let rec render_inline = function
			| Text s -> s
			| Bold inlines -> "**" ^ (render_inlines inlines) ^ "**"
			| Italic inlines -> "*" ^ (render_inlines inlines) ^ "*"
			| Underline inlines -> "<ins>" ^ (render_inlines inlines) ^ "</ins>"
			| Strikethrough inlines -> "~~" ^ (render_inlines inlines) ^ "~~"
			| Spoiler inlines -> "||" ^ (render_inlines inlines) ^ "||"
			| InlineCode s -> "`" ^ s ^ "`"
			| Superscript inlines -> "<sup>" ^ (render_inlines inlines) ^ "</sup>"
			| Subscript inlines -> "<sub>" ^ (render_inlines inlines) ^ "</sub>"
			| Math s -> "$" ^ s ^ "$"
			| Variable s -> s
			| InlineComment _ -> ""
			| Link link_type -> render_link link_type
			| Anchor anchor_type -> render_anchor anchor_type
			| InlineLinkTarget s -> s
		
		and render_inlines inlines =
			String.concat "" (List.map render_inline inlines)
		
		and render_link = function
			| LinkLocation (loc, None) -> "<" ^ render_link_location loc ^ ">"
			| LinkLocation (loc, Some desc) -> "[" ^ render_inlines desc ^ "](" ^ render_link_location loc ^ ")"
			| InlineLink s -> "<" ^ s ^ ">"
		
		and render_link_location = function
			| Heading (_, s) -> "#" ^ (String.lowercase_ascii (String.map (function ' ' -> '-' | c -> c) s))
			| Definition s -> "#definition-" ^ (String.lowercase_ascii s)
			| Footnote s -> "#footnote-" ^ (String.lowercase_ascii s)
			| FilePath (path, _) -> path
			| LineNumber n -> "#L" ^ string_of_int n
			| Url s -> s
			| FileLink (path, None) -> path
			| FileLink (path, Some line) -> path ^ "#L" ^ string_of_int line
			| MagicLink s -> "#" ^ (String.lowercase_ascii s)
			| TimestampLink s -> s
			| WikiLink s -> s
			| ExtendableLink s -> s
		
		and render_anchor = function
			| AnchorDeclaration s -> s
			| AnchorDefinition (s, loc) -> "[" ^ s ^ "](" ^ render_link_location loc ^ ")"
		
		let rec render_block ?(indent=0) = function
			| Paragraph inlines -> String.make indent ' ' ^ render_inlines inlines
		| Heading (level, title, blocks) ->
				String.make level '#' ^ " " ^ title ^ "\n\n" ^ 
				String.concat "\n\n" (List.map (render_block ~indent:indent) blocks)
		| UnorderedList (level, blocks) ->
				String.concat "\n" (List.map (fun block ->
					String.make (indent + (level - 1) * 2) ' ' ^ "- " ^ render_block ~indent:(indent + level * 2) block
				) blocks)
		| OrderedList (level, blocks) ->
				let rec number_items items n =
					match items with
					| [] -> []
					| item :: rest -> 
						(String.make (indent + (level - 1) * 2) ' ' ^ string_of_int n ^ ". " ^ 
							render_block ~indent:(indent + level * 2) item) :: 
						number_items rest (n + 1)
				in
				String.concat "\n" (number_items blocks 1)
		| Quote (level, blocks) ->
				String.concat "\n" (List.map (fun block ->
					String.make level '>' ^ " " ^ render_block ~indent:indent block
				) blocks)
		| Definition (title, blocks) ->
				String.make indent ' ' ^ "**" ^ title ^ "**: " ^ 
				String.concat "\n" (List.map (render_block ~indent:(indent + 2)) blocks)
		| DefinitionMulti (title, blocks) ->
				String.make indent ' ' ^ "**" ^ title ^ "**:\n" ^ 
				String.concat "\n\n" (List.map (render_block ~indent:(indent + 2)) blocks)
		| Footnote (title, blocks) ->
				String.make indent ' ' ^ "[^" ^ title ^ "]: " ^ 
				String.concat "\n" (List.map (render_block ~indent:(indent + 4)) blocks)
		| FootnoteMulti (title, blocks) ->
				String.make indent ' ' ^ "[^" ^ title ^ "]: " ^ 
				String.concat "\n\n" (List.map (render_block ~indent:(indent + 4)) blocks)
		| CodeBlock (None, code) ->
				String.make indent ' ' ^ "```\n" ^ code ^ "\n```"
		| CodeBlock (Some lang, code) ->
				String.make indent ' ' ^ "```" ^ lang ^ "\n" ^ code ^ "\n```"
		| Table _ -> String.make indent ' ' ^ "<!-- Table not supported in this renderer -->"
		| HorizontalRule -> String.make indent ' ' ^ "---"
			| DetachedModifierExtension ext -> render_extension ~indent ext
			| Tag tag -> render_tag ~indent tag
		
		and render_extension ~indent = function
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
		
		and render_tag ~indent = function
		| RangedTag (MacroTag (_, _, _)) -> String.make indent ' ' ^ "<!-- Macro tag -->"
		| RangedTag (StandardTag ("comment", _, _)) -> ""
		| RangedTag (StandardTag ("example", _, blocks)) -> 
				String.concat "\n\n" (List.map (render_block ~indent) blocks)
		| RangedTag (StandardTag ("details", _, blocks)) ->
				String.make indent ' ' ^ "<details>\n" ^ 
				String.concat "\n\n" (List.map (render_block ~indent:(indent + 2)) blocks) ^
				"\n" ^ String.make indent ' ' ^ "</details>"
		| RangedTag (StandardTag (name, _, blocks)) ->
				String.make indent ' ' ^ "<!-- " ^ name ^ " start -->\n" ^
				String.concat "\n\n" (List.map (render_block ~indent) blocks) ^
				"\n" ^ String.make indent ' ' ^ "<!-- " ^ name ^ " end -->"
		| RangedTag (VerbatimTag ("code", [lang], code)) ->
				String.make indent ' ' ^ "```" ^ lang ^ "\n" ^ code ^ "\n" ^ String.make indent ' ' ^ "```" 
		| RangedTag (VerbatimTag ("code", [], code)) ->
				String.make indent ' ' ^ "```\n" ^ code ^ "\n" ^ String.make indent ' ' ^ "```"
		| RangedTag (VerbatimTag ("document.meta", _, content)) ->
				"---\n" ^ content ^ "---"
		| RangedTag (VerbatimTag ("image", params, _)) ->
				String.make indent ' ' ^ "![" ^ (String.concat " " params) ^ "](image)"
		| RangedTag (VerbatimTag ("math", _, content)) ->
				String.make indent ' ' ^ "$$\n" ^ content ^ "\n$$"
		| RangedTag (VerbatimTag (name, _, _)) ->
				String.make indent ' ' ^ "<!-- " ^ name ^ " verbatim tag -->"
		| CarryoverTag (Strong (name, params, block)) ->
				render_block ~indent block ^ 
				" <!-- Strong carryover tag: " ^ name ^ " " ^ String.concat " " params ^ " -->"
		| CarryoverTag (Weak (name, params, block)) ->
				render_block ~indent block ^ 
				" <!-- Weak carryover tag: " ^ name ^ " " ^ String.concat " " params ^ " -->"
		| InfirmTag (name, params) ->
				String.make indent ' ' ^ "<!-- Infirm tag: " ^ name ^ " " ^ String.concat " " params ^ " -->"
		
		let render blocks =
			String.concat "\n\n" (List.map (render_block ~indent:0) blocks)
	end
	
	module Html = struct
		let rec render_inline = function
			| Text s -> s
			| Bold inlines -> "<strong>" ^ (render_inlines inlines) ^ "</strong>"
			| Italic inlines -> "<em>" ^ (render_inlines inlines) ^ "</em>"
			| Underline inlines -> "<ins>" ^ (render_inlines inlines) ^ "</ins>"
			| Strikethrough inlines -> "<del>" ^ (render_inlines inlines) ^ "</del>"
			| Spoiler inlines -> "<span class=\"spoiler\">" ^ (render_inlines inlines) ^ "</span>"
			| InlineCode s -> "<code>" ^ s ^ "</code>"
			| Superscript inlines -> "<sup>" ^ (render_inlines inlines) ^ "</sup>"
			| Subscript inlines -> "<sub>" ^ (render_inlines inlines) ^ "</sub>"
			| Math s -> "<span class=\"math\">\\(" ^ s ^ "\\)</span>"
			| Variable s -> s
			| InlineComment _ -> ""
			| Link link_type -> render_link link_type
			| Anchor anchor_type -> render_anchor anchor_type
			| InlineLinkTarget s -> "<span id=\"" ^ s ^ "\">" ^ s ^ "</span>"
		
		and render_inlines inlines =
			String.concat "" (List.map render_inline inlines)
		
		and render_link = function
			| LinkLocation (loc, None) -> "<a href=\"" ^ render_link_location loc ^ "\">" ^ render_link_location loc ^ "</a>"
			| LinkLocation (loc, Some desc) -> "<a href=\"" ^ render_link_location loc ^ "\">" ^ render_inlines desc ^ "</a>"
			| InlineLink s -> "<span id=\"" ^ s ^ "\">" ^ s ^ "</span>"
		
		and render_link_location = function
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
		
		and render_anchor = function
			| AnchorDeclaration s -> s
			| AnchorDefinition (s, loc) -> "<a href=\"" ^ render_link_location loc ^ "\">" ^ s ^ "</a>"
		
		let rec render_block = function
			| Paragraph inlines -> "<p>" ^ render_inlines inlines ^ "</p>"
		| Heading (level, title, blocks) ->
				let h_tag = "h" ^ string_of_int (min level 6) in
				"<" ^ h_tag ^ " id=\"" ^ String.lowercase_ascii title ^ "\">" ^ title ^ "</" ^ h_tag ^ ">" ^
				String.concat "" (List.map render_block blocks)
		| UnorderedList (_, blocks) ->
				"<ul>" ^ 
				String.concat "" (List.map (fun block -> "<li>" ^ render_block block ^ "</li>") blocks) ^
				"</ul>"
		| OrderedList (_, blocks) ->
				"<ol>" ^ 
				String.concat "" (List.map (fun block -> "<li>" ^ render_block block ^ "</li>") blocks) ^
				"</ol>"
		| Quote (_, blocks) ->
				"<blockquote>" ^ 
				String.concat "" (List.map render_block blocks) ^
				"</blockquote>"
		| Definition (title, blocks) ->
				"<dl><dt id=\"" ^ String.lowercase_ascii title ^ "\">" ^ title ^ "</dt><dd>" ^ 
				String.concat "" (List.map render_block blocks) ^
				"</dd></dl>"
		| DefinitionMulti (title, blocks) ->
				"<dl><dt id=\"" ^ String.lowercase_ascii title ^ "\">" ^ title ^ "</dt><dd>" ^ 
				String.concat "" (List.map render_block blocks) ^
				"</dd></dl>"
		| Footnote (title, blocks) ->
				"<div class=\"footnote\" id=\"fn-" ^ String.lowercase_ascii title ^ "\"><sup>" ^ title ^ "</sup> " ^ 
				String.concat "" (List.map render_block blocks) ^
				"</div>"
		| FootnoteMulti (title, blocks) ->
				"<div class=\"footnote\" id=\"fn-" ^ String.lowercase_ascii title ^ "\"><sup>" ^ title ^ "</sup> " ^ 
				String.concat "" (List.map render_block blocks) ^
				"</div>"
		| CodeBlock (None, code) ->
				"<pre><code>" ^ code ^ "</code></pre>"
		| CodeBlock (Some lang, code) ->
				"<pre><code class=\"language-" ^ lang ^ "\">" ^ code ^ "</code></pre>"
		| Table _ -> "<div><!-- Table not supported in this renderer --></div>"
		| HorizontalRule -> "<hr>"
			| DetachedModifierExtension ext -> render_extension ext
			| Tag tag -> render_tag tag
		
		and render_extension = function
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
		
		and render_tag = function
		| RangedTag (MacroTag (_, _, _)) -> "<!-- Macro tag -->"
		| RangedTag (StandardTag ("comment", _, _)) -> ""
		| RangedTag (StandardTag ("example", _, blocks)) -> 
				"<div class=\"example\">" ^
				String.concat "" (List.map render_block blocks) ^
				"</div>"
		| RangedTag (StandardTag ("details", _, blocks)) ->
				"<details><summary>Details</summary>" ^ 
				String.concat "" (List.map render_block blocks) ^
				"</details>"
		| RangedTag (StandardTag (name, _, blocks)) ->
				"<div class=\"" ^ name ^ "\">" ^
				String.concat "" (List.map render_block blocks) ^
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
				render_block block ^
				"</div>"
		| CarryoverTag (Weak (name, params, block)) ->
				"<span class=\"" ^ name ^ " " ^ String.concat " " params ^ "\">" ^
				render_block block ^
				"</span>"
		| InfirmTag (name, params) ->
				"<!-- Infirm tag: " ^ name ^ " " ^ String.concat " " params ^ " -->"
		
		let render blocks =
			"<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"UTF-8\">\n<title>Norg Document</title>\n<style>\n" ^
			"body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; }\n" ^
			".spoiler { background-color: black; color: black; }\n" ^
			".spoiler:hover { color: white; }\n" ^
			"</style>\n</head>\n<body>\n" ^
			String.concat "\n" (List.map render_block blocks) ^
			"\n</body>\n</html>"
	end
	
	module Json = struct
		let json_object pairs =
			let format_pair (key, value) = Printf.sprintf "\"%s\":%s" key value in
			"{" ^ String.concat "," (List.map format_pair pairs) ^ "}"
		
		let json_string s = "\"" ^ String.escaped s ^ "\""
		let json_int i = string_of_int i
		let json_array items = "[" ^ String.concat "," items ^ "]"
		
		let json_type_object type_name content_pairs =
			json_object (("type", json_string type_name) :: content_pairs)
		
		let rec render_inline = function
		| Text s -> 
				json_type_object "text" ["content", json_string s]
		| Bold inlines -> 
				json_type_object "bold" ["content", json_array [render_inlines inlines]]
		| Italic inlines -> 
				json_type_object "italic" ["content", json_array [render_inlines inlines]]
		| Underline inlines -> 
				json_type_object "underline" ["content", json_array [render_inlines inlines]]
		| Strikethrough inlines -> 
				json_type_object "strikethrough" ["content", json_array [render_inlines inlines]]
		| Spoiler inlines -> 
				json_type_object "spoiler" ["content", json_array [render_inlines inlines]]
		| InlineCode s -> 
				json_type_object "inlineCode" ["content", json_string s]
		| Superscript inlines -> 
				json_type_object "superscript" ["content", json_array [render_inlines inlines]]
		| Subscript inlines -> 
				json_type_object "subscript" ["content", json_array [render_inlines inlines]]
		| Math s -> 
				json_type_object "math" ["content", json_string s]
		| Variable s -> 
				json_type_object "variable" ["content", json_string s]
		| InlineComment s -> 
				json_type_object "inlineComment" ["content", json_string s]
		| Link link_type -> 
				json_type_object "link" ["content", render_link link_type]
		| Anchor anchor_type -> 
				json_type_object "anchor" ["content", render_anchor anchor_type]
		| InlineLinkTarget s -> 
				json_type_object "inlineLinkTarget" ["content", json_string s]
	
	and render_inlines inlines =
			String.concat "," (List.map render_inline inlines)
  
	and render_link = function
		| LinkLocation (loc, None) -> 
				json_type_object "linkLocation" ["location", render_link_location loc]
		| LinkLocation (loc, Some desc) -> 
				json_type_object "linkLocationWithDesc" [
					"location", render_link_location loc;
					"description", json_array [render_inlines desc]
				]
		| InlineLink s -> 
				json_type_object "inlineLink" ["content", json_string s]
  
	and render_link_location = function
		| Heading (level, s) -> 
				json_type_object "heading" [
					"level", json_int level;
					"content", json_string s
				]
		| Definition s -> 
				json_type_object "definition" ["content", json_string s]
		| Footnote s -> 
				json_type_object "footnote" ["content", json_string s]
		| FilePath (path, None) -> 
				json_type_object "filePath" ["path", json_string path]
		| FilePath (path, Some target) -> 
				json_type_object "filePathWithTarget" [
					"path", json_string path;
					"target", render_link_target target
				]
		| LineNumber n -> 
				json_type_object "lineNumber" ["line", json_int n]
		| Url s -> 
				json_type_object "url" ["url", json_string s]
		| FileLink (path, None) -> 
				json_type_object "fileLink" ["path", json_string path]
		| FileLink (path, Some line) -> 
				json_type_object "fileLinkWithLine" [
					"path", json_string path;
					"line", json_int line
				]
		| MagicLink s -> 
				json_type_object "magicLink" ["content", json_string s]
		| TimestampLink s -> 
				json_type_object "timestampLink" ["content", json_string s]
		| WikiLink s -> 
				json_type_object "wikiLink" ["content", json_string s]
		| ExtendableLink s -> 
				json_type_object "extendableLink" ["content", json_string s]
  
	and render_link_target = function
		| HeadingTarget (level, s) -> 
				json_type_object "headingTarget" [
					"level", json_int level;
					"content", json_string s
				]
		| DefinitionTarget s -> 
				json_type_object "definitionTarget" ["content", json_string s]
		| FootnoteTarget s -> 
				json_type_object "footnoteTarget" ["content", json_string s]
		| MagicTarget s -> 
				json_type_object "magicTarget" ["content", json_string s]
		| LineNumberTarget n -> 
				json_type_object "lineNumberTarget" ["line", json_int n]
  
	and render_anchor = function
		| AnchorDeclaration s -> 
				json_type_object "anchorDeclaration" ["content", json_string s]
		| AnchorDefinition (s, loc) -> 
				json_type_object "anchorDefinition" [
					"content", json_string s;
					"location", render_link_location loc
				]
  
	let rec render_block = function
		| Paragraph inlines -> 
				json_type_object "paragraph" ["content", json_array [render_inlines inlines]]
		| Heading (level, title, blocks) ->
				json_type_object "heading" [
					"level", json_int level;
					"title", json_string title;
					"content", json_array [render_blocks blocks]
				]
		| UnorderedList (level, blocks) ->
				json_type_object "unorderedList" [
					"level", json_int level;
					"content", json_array [render_blocks blocks]
				]
		| OrderedList (level, blocks) ->
				json_type_object "orderedList" [
					"level", json_int level;
					"content", json_array [render_blocks blocks]
				]
		| Quote (level, blocks) ->
				json_type_object "quote" [
					"level", json_int level;
					"content", json_array [render_blocks blocks]
				]
		| Definition (title, blocks) ->
				json_type_object "definition" [
					"title", json_string title;
					"content", json_array [render_blocks blocks]
				]
		| DefinitionMulti (title, blocks) ->
				json_type_object "definitionMulti" [
					"title", json_string title;
					"content", json_array [render_blocks blocks]
				]
		| Footnote (title, blocks) ->
				json_type_object "footnote" [
					"title", json_string title;
					"content", json_array [render_blocks blocks]
				]
		| FootnoteMulti (title, blocks) ->
				json_type_object "footnoteMulti" [
					"title", json_string title;
					"content", json_array [render_blocks blocks]
				]
		| CodeBlock (None, code) ->
				json_type_object "codeBlock" [
					"language", "null";
					"content", json_string code
				]
		| CodeBlock (Some lang, code) ->
				json_type_object "codeBlock" [
					"language", json_string lang;
					"content", json_string code
				]
		| Table _ -> 
				json_type_object "table" ["content", json_string "Not implemented"]
		| HorizontalRule -> 
				json_type_object "horizontalRule" []
		| DetachedModifierExtension ext -> 
				json_type_object "detachedModifierExtension" ["content", render_extension ext]
		| Tag tag -> 
				json_type_object "tag" ["content", render_tag tag]
  
	and render_blocks blocks =
		String.concat "," (List.map render_block blocks)
  
	and render_extension = function
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
				json_type_object "todoStatus" ["status", json_string status_str]
		| Priority p -> 
				json_type_object "priority" ["priority", json_string p]
		| DueDate d -> 
				json_type_object "dueDate" ["date", json_string d]
		| StartDate d -> 
				json_type_object "startDate" ["date", json_string d]
		| Timestamp d -> 
				json_type_object "timestamp" ["date", json_string d]
  
	and render_tag = function
		| RangedTag (MacroTag (name, params, content)) -> 
				let json_params = json_array (List.map json_string params) in
				json_type_object "macroTag" [
					"name", json_string name;
					"params", json_params;
					"content", json_string content
				]
		| RangedTag (StandardTag (name, params, blocks)) -> 
				let json_params = json_array (List.map json_string params) in
				json_type_object "standardTag" [
					"name", json_string name;
					"params", json_params;
					"content", json_array [render_blocks blocks]
				]
		| RangedTag (VerbatimTag ("document.meta", params, content)) -> 
				let json_params = json_array (List.map json_string params) in
				json_type_object "documentMeta" [
					"format", json_string "yaml";
					"params", json_params;
					"content", json_string content
				]
		| RangedTag (VerbatimTag (name, params, content)) -> 
				let json_params = json_array (List.map json_string params) in
				json_type_object "verbatimTag" [
					"name", json_string name;
					"params", json_params;
					"content", json_string content
				]
		| CarryoverTag (Strong (name, params, block)) -> 
				let json_params = json_array (List.map json_string params) in
				json_type_object "strongCarryoverTag" [
					"name", json_string name;
					"params", json_params;
					"content", render_block block
				]
		| CarryoverTag (Weak (name, params, block)) -> 
				let json_params = json_array (List.map json_string params) in
				json_type_object "weakCarryoverTag" [
					"name", json_string name;
					"params", json_params;
					"content", render_block block
				]
		| InfirmTag (name, params) -> 
				let json_params = json_array (List.map json_string params) in
				json_type_object "infirmTag" [
					"name", json_string name;
					"params", json_params
				]
		
		let render blocks =
			let _content = json_array [render_blocks blocks] in
			Printf.sprintf "{\n  \"type\": \"document\",\n  \"content\": [\n    %s\n  ]\n}" 
				(String.concat ",\n    " (List.map render_block blocks))
	end
	
	let to_markdown = Markdown.render
	let to_html = Html.render
	let to_json = Json.render
end

let parse = Parser.parse
let to_markdown = Renderer.to_markdown
let to_html = Renderer.to_html
let to_json = Renderer.to_json
