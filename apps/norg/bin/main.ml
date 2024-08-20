open Norg

let () =
  let input = 
    "  \t* Your Quick Neorg Guide\n\
  This is a cheatsheet that quickly lets you get a grip on the Norg syntax.\n\
   * Heading 1\n\
   ** Heading 2\n\
   *** Heading 3\n\
   **** And so on...\n\
   "
  in
  match parse_whitespace_many input with
  | [] -> print_endline "No match"
  | (result, remaining)::_ ->
      Printf.printf "Matched: '%s', Remaining: '%s'\n" result remaining

