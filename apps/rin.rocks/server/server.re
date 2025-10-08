let app = request => {
  let _path = request |> Dream.target |> Dream.from_path;

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

  responseStream(<Document> <App /> </Document>);
};

Dream.run(~port=8080) @@
Dream.logger @@
Dream_livereload.inject_script() @@
Dream.router([
  Dream.get("/", app),
  Dream.get("/try-static-markup", _ =>
    <Document> <App /> </Document>
    |> ReactDOM.renderToStaticMarkup
    |> Dream.html
  ),
  Dream.get("/blog", app),
  Dream_livereload.route(),
]);
