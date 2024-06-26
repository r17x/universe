let app = request => {
  let path = request |> Dream.target |> Dream.from_path;

  let responseStream = element => {
    let data_stream = response_stream => {
      let (stream, _) = ReactDOM.renderToLwtStream(element);

      stream
      |> Lwt_stream.iter_s(data => {
           let%lwt () = Dream.write(response_stream, data);
           Dream.flush(response_stream);
         });
    };

    Dream.stream(data_stream);
  };

  responseStream(
    <Page> <App serverUrl={path, hash: "", search: ""} /> </Page>,
  );
};

let () =
  Dream.run @@
  Dream.logger @@
  Dream.router([Dream.get("/", app), Dream.get("/blog", app)]);
