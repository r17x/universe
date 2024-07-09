module Spotify_j = Spotify_api_j
module Spotify_t = Spotify_api_t

module Common = struct
  let base_uri = "https://api.spotify.com/v1"
end

module Remote = struct
  let read_uri ?headers uri parser =
    let open Cohttp_lwt_unix in
    let open Lwt.Infix in
    Client.call ?headers ~chunked:false `GET uri >>= fun (_, body) ->
    Cohttp_lwt__Body.to_string body >>= fun data -> Lwt.return (parser data)
end

(*
module Me = struct
  module Player = struct

    let current_playing = 
  end
end
*)
