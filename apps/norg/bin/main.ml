(* Command line argument parsing *)
let output_format = ref "markdown"
let input_format = ref "norg"
let input_file = ref ""
let output_file = ref None

let set_output_file s = output_file := Some s

let spec_list = [
  ("--output", Arg.Symbol (["markdown"; "html"; "json"], 
            (fun s -> output_format := s)), 
    " Specify output format (markdown, html, or json)");
  ("--input", Arg.Symbol (["norg"; "markdown"], 
            (fun s -> input_format := s)), 
    " Specify input format (norg or markdown)");
  ("--out", Arg.String set_output_file,
    " Specify output file (defaults to stdout)")
]

let usage_msg = "Usage: norg [options] <input_file>"

let anon_fun filename = input_file := filename

(* Parse input file based on format and create AST *)
let parse_input_file filename format =
  try
    let content = 
      let ic = open_in filename in
      let rec read_all acc =
        try
          let line = input_line ic in
          read_all (acc ^ line ^ "\n")
        with End_of_file ->
          close_in ic;
          acc
      in
      read_all ""
    in
    match format with
    | "norg" -> Norg.parse content
    | "markdown" -> Norg.parse_markdown content
    | _ -> failwith ("Unsupported input format: " ^ format)
  with
  | Sys_error msg -> Printf.eprintf "Error: %s\n" msg; exit 1
  | Failure msg -> Printf.eprintf "Parsing error: %s\n" msg; exit 1

(* Convert parsed Norg file to target format *)
let convert_to_format parsed_content format =
  match format with
  | "markdown" -> Norg.to_markdown parsed_content
  | "html" -> Norg.to_html parsed_content
  | "json" -> Norg.to_json parsed_content
  | _ -> failwith ("Unsupported output format: " ^ format)

(* Write output to file or stdout *)
let write_output output out_file =
  match out_file with
  | None -> print_endline output
  | Some filename ->
      let oc = open_out filename in
      output_string oc output;
      close_out oc

(* Main function *)
let () =
  Arg.parse spec_list anon_fun usage_msg;
  
  if !input_file = "" then begin
    Printf.eprintf "Error: No input file specified\n";
    Arg.usage spec_list usage_msg;
    exit 1
  end;
  
  let parsed_content = parse_input_file !input_file !input_format in
  let output = convert_to_format parsed_content !output_format in
  write_output output !output_file