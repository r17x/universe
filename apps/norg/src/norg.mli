(** Norg Parser and Renderer Library
    
    This library provides parsing and rendering capabilities for the Norg markup language.
    It supports conversion from Norg documents to Markdown, HTML, and JSON formats.
*)

(** Abstract Syntax Tree definitions for Norg documents *)
module Ast : sig
  (** Basic inline elements that can appear within text *)
  type inline =
    | Text of string                    (** Plain text content *)
    | Bold of inline list              (** Bold formatting: *text* *)
    | Italic of inline list            (** Italic formatting: /text/ *)
    | Underline of inline list         (** Underlined text: _text_ *)
    | Strikethrough of inline list     (** Strikethrough text: -text- *)
    | Spoiler of inline list           (** Spoiler text: !text! *)
    | InlineCode of string             (** Inline code: `text` *)
    | Superscript of inline list       (** Superscript: ^text^ *)
    | Subscript of inline list         (** Subscript: ,text, *)
    | Math of string                   (** Math expression: $formula$ *)
    | Variable of string               (** Variable reference: &var& *)
    | InlineComment of string          (** Inline comment: %comment% *)
    | Link of link                     (** Link elements *)
    | Anchor of anchor                 (** Anchor elements *)
    | InlineLinkTarget of string       (** Inline link target *)

  (** Link types and destinations *)
  and link =
    | LinkLocation of link_location * inline list option  (** Link with optional description *)
    | InlineLink of string                                (** Simple inline link *)

  (** Specific link location types *)
  and link_location =
    | Heading of int * string          (** Heading link: level and title *)
    | Definition of string             (** Definition link *)
    | Footnote of string              (** Footnote link *)
    | FilePath of string * link_target option  (** File path with optional target *)
    | LineNumber of int               (** Line number reference *)
    | Url of string                   (** External URL *)
    | FileLink of string * int option (** File link with optional line number *)
    | MagicLink of string             (** Magic link *)
    | TimestampLink of string         (** Timestamp link *)
    | WikiLink of string              (** Wiki-style link *)
    | ExtendableLink of string        (** Extendable link *)

  (** Link target specifications *)
  and link_target =
    | HeadingTarget of int * string    (** Target heading with level and title *)
    | DefinitionTarget of string       (** Target definition *)
    | FootnoteTarget of string         (** Target footnote *)
    | MagicTarget of string           (** Target magic link *)
    | LineNumberTarget of int         (** Target line number *)

  (** Anchor elements for reversed link syntax *)
  and anchor =
    | AnchorDeclaration of string                    (** Anchor declaration *)
    | AnchorDefinition of string * link_location    (** Anchor definition with target *)

  (** Block-level elements that form document structure *)
  type block =
    | Paragraph of inline list                      (** Text paragraph *)
    | Heading of int * string * block list         (** Heading with level, title, and content *)
    | UnorderedList of int * block list            (** Unordered list with nesting level *)
    | OrderedList of int * block list              (** Ordered list with nesting level *)
    | Quote of int * block list                    (** Quote block with nesting level *)
    | Definition of string * block list            (** Definition with title and content *)
    | DefinitionMulti of string * block list       (** Multi-paragraph definition *)
    | Footnote of string * block list              (** Footnote with title and content *)
    | FootnoteMulti of string * block list         (** Multi-paragraph footnote *)
    | CodeBlock of string option * string          (** Code block with optional language *)
    | Table of table                               (** Table structure *)
    | HorizontalRule                               (** Horizontal rule separator *)
    | DetachedModifierExtension of extension       (** Detached modifier extension *)
    | Tag of tag                                   (** Tag elements *)

  (** Extension elements for task tracking and metadata *)
  and extension =
    | TodoStatus of todo_status        (** Todo status indicator *)
    | Priority of string              (** Priority level *)
    | DueDate of string               (** Due date *)
    | StartDate of string             (** Start date *)
    | Timestamp of string             (** Timestamp *)

  (** Todo status options for task management *)
  and todo_status =
    | Undone                          (** Unchecked task: ( ) *)
    | Done                            (** Completed task: (x) *)
    | NeedsInput                      (** Task needing input: (?) *)
    | Urgent                          (** Urgent task: (!) *)
    | Recurring of string option      (** Recurring task: (+) *)
    | InProgress                      (** Task in progress: (-) *)
    | OnHold                          (** Task on hold: (=) *)
    | Cancelled                       (** Cancelled task: (_) *)

  (** Table structure representation *)
  and table = {
    headers: string list option;      (** Optional table headers *)
    rows: string list list;           (** Table rows as lists of cells *)
  }

  (** Tag elements for advanced markup *)
  and tag =
    | RangedTag of ranged_tag         (** Multi-line tag *)
    | CarryoverTag of carryover_tag   (** Single-line carryover tag *)
    | InfirmTag of string * string list  (** Infirm tag with parameters *)

  (** Ranged tag types that span multiple lines *)
  and ranged_tag =
    | MacroTag of string * string list * string      (** Macro tag with name, params, content *)
    | StandardTag of string * string list * block list  (** Standard tag with parsed content *)
    | VerbatimTag of string * string list * string   (** Verbatim tag with raw content *)

  (** Carryover tag types that affect following content *)
  and carryover_tag =
    | Strong of string * string list * block         (** Strong carryover tag *)
    | Weak of string * string list * block          (** Weak carryover tag *)

  (** A complete Norg document represented as a list of blocks *)
  type document = block list
end

(** Parser module for converting Norg text to AST *)
module Parser : sig
  (** Parse a Norg document string into an AST
      @param input The Norg document as a string
      @return The parsed document as an AST
      @raise Failure if parsing fails with error message *)
  val parse : string -> Ast.document
end

(** Markdown parser module for converting Markdown text to Norg AST *)
module MarkdownParser : sig
  (** Parse a Markdown document string into a Norg AST
      @param input The Markdown document as a string
      @return The parsed document as a Norg AST
      @raise Failure if parsing fails with error message *)
  val parse : string -> Ast.document
end

(** Renderer module for converting AST to various output formats *)
module Renderer : sig
  
  (** Markdown rendering module *)
  module Markdown : sig
    (** Render an AST document to Markdown format
        @param blocks The document blocks to render
        @return Markdown-formatted string *)
    val render : Ast.block list -> string
  end

  (** HTML rendering module *)
  module Html : sig
    (** Render an AST document to HTML format with complete document structure
        @param blocks The document blocks to render
        @return Complete HTML document string with DOCTYPE, head, and styling *)
    val render : Ast.block list -> string
  end

  (** JSON rendering module *)
  module Json : sig
    (** Render an AST document to structured JSON format
        @param blocks The document blocks to render
        @return Pretty-formatted JSON string representing the document structure *)
    val render : Ast.block list -> string
  end

  (** Backwards compatibility functions *)
  
  (** Legacy function for Markdown rendering
      @param blocks The document blocks to render
      @return Markdown-formatted string *)
  val to_markdown : Ast.block list -> string

  (** Legacy function for HTML rendering
      @param blocks The document blocks to render
      @return Complete HTML document string *)
  val to_html : Ast.block list -> string

  (** Legacy function for JSON rendering
      @param blocks The document blocks to render
      @return JSON-formatted string *)
  val to_json : Ast.block list -> string
end

(** Main module interface for convenient access *)

(** Parse a Norg document string into an AST
    @param input The Norg document as a string
    @return The parsed document as an AST
    @raise Failure if parsing fails *)
val parse : string -> Ast.document

(** Parse a Markdown document string into a Norg AST for bidirectional conversion
    @param input The Markdown document as a string
    @return The parsed document as a Norg AST
    @raise Failure if parsing fails *)
val parse_markdown : string -> Ast.document

(** Render an AST document to Markdown format
    @param blocks The document blocks to render
    @return Markdown-formatted string *)
val to_markdown : Ast.block list -> string

(** Render an AST document to HTML format
    @param blocks The document blocks to render
    @return Complete HTML document string *)
val to_html : Ast.block list -> string

(** Render an AST document to JSON format
    @param blocks The document blocks to render
    @return JSON-formatted string *)
val to_json : Ast.block list -> string