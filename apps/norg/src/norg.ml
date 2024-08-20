module S = String

type 'tree parser = string -> ('tree * string) list

module SpecialChar = struct
  type t = 
  | Asterisk
  | Dash
  | Tilde
  | Slash
  | Underscore
  | Exclamation
  | Percent
  | Caret
  | Comma
  | QuotationMark
  | SingleQuote
  | Dollar
  | Colon
  | At
  | Pipe
  | Equal
  | Dot
  | Plus
  | Hash
  | LessThan
  | GreaterThan
  | LeftParenthesis
  | RightParenthesis
  | LeftBracket
  | RightBracket
  | LeftBrace
  | RightBrace
  | Backslash

  let asterisk = Asterisk
  let dash = Dash
  let tilde = Tilde
  let slash = Slash
  let underscore = Underscore
  let exclamation = Exclamation
  let percent = Percent
  let caret = Caret
  let comma = Comma
  let quotation_mark = QuotationMark
  let single_quote = SingleQuote
  let dollar = Dollar
  let colon = Colon
  let at = At
  let pipe = Pipe
  let equal = Equal
  let dot = Dot
  let plus = Plus
  let hash = Hash
  let less_than = LessThan
  let greater_than = GreaterThan
  let left_parenthesis = LeftParenthesis
  let right_parenthesis = RightParenthesis
  let left_bracket = LeftBracket
  let right_bracket = RightBracket
  let left_brace = LeftBrace
  let right_brace = RightBrace
  let backslash = Backslash

  let from_char = function
    | '*' -> Some Asterisk
    | '-' -> Some Dash
    | '~' -> Some Tilde
    | '/' -> Some Slash
    | '_' -> Some Underscore
    | '!' -> Some Exclamation
    | '%' -> Some Percent
    | '^' -> Some Caret
    | ',' -> Some Comma
    | '"' -> Some QuotationMark
    | '\'' -> Some SingleQuote
    | '$' -> Some Dollar
    | ':' -> Some Colon
    | '@' -> Some At
    | '|' -> Some Pipe
    | '=' -> Some Equal
    | '.' -> Some Dot
    | '+' -> Some Plus
    | '#' -> Some Hash
    | '<' -> Some LessThan
    | '>' -> Some GreaterThan
    | '(' -> Some LeftParenthesis
    | ')' -> Some RightParenthesis
    | '[' -> Some LeftBracket
    | ']' -> Some RightBracket
    | '{' -> Some LeftBrace
    | '}' -> Some RightBrace
    | '\\' -> Some Backslash
    | _ -> None
end

type token = 
  | Whitespace of int 
  | Newline 
  | Newlines of int 
  | Special of special_char  
  | End of char
  | Escape of char
  | Eof

and special_char = SpecialChar.t


module Whitespace = struct
  type t = | Space | Tab

  let space = Space
  let tab = Tab

  let is_whitespace_char = function
    | ' ' | '\t' -> true
    | _ -> false

  let from_char = function
    | ' ' -> Some Space
    | '\t' -> Some Tab
    | _ -> None

  let to_char = function
    | Space -> ' '
    | Tab -> '\t'
  
end

let rec ws = function
  | "" -> []
  | s  when Whitespace.is_whitespace_char s.[0] -> s.[0]
    |> Whitespace.from_char 
    |> Option.map (fun c -> [(c, S.sub s 1 (S.length s - 1))])
    |> Option.value ~default:[]
    |> List.append (ws (S.sub s 1 (S.length s - 1)))
  | _ -> []

let char c = function
  | "" -> []
  | s when s.[0] = c -> [(c, S.sub s 1 (S.length s - 1))]
  | _ -> []

let parse_tab = char '\t'
let parse_space = char ' '
let parse_whitespace = fun input ->
  parse_space input @ parse_tab input
(* A combinator that applies the given parser repeatedly until it fails *)
let rec many p = fun input ->
  match p input with
  | [] -> [([], input)]  (* No more matches, return the empty list *)
  | (result, remaining):: _ ->
      let (results, final_remaining) = List.hd (many p remaining) in
      ((result :: results), final_remaining) :: []

let (<*>) = many
(* A parser that matches one or more whitespace characters *)
let parse_whitespace_many : string parser = fun input ->
  let parsed_results = many parse_whitespace input in
  match parsed_results with
  | (results, remaining):: _ ->
      let whitespace_string = String.concat "" (List.map (String.make 1) results) in
      [(whitespace_string, remaining)]
  | [] -> []

(* Parser combinator: choice between two parsers *)
let (<|>) (p1: 'a parser) (p2: 'a parser): 'a parser =
  fun i ->
    let r1 = p1 i in
    if r1 <> [] then r1
    else p2 i

(* Parser combinator: sequence of two parsers *)
let (>>=) (p: 'a parser) (f: 'a -> 'b parser): 'b parser =
  fun i ->
    let r = p i in
    List.flatten (List.map (fun (a, rest) -> f a rest) r)

(* Parser combinator: sequence of two parsers, discarding the result of the first parser *)
let (>>) (p1: 'a parser) (p2: 'b parser): 'b parser =
  p1 >>= fun _ -> p2

