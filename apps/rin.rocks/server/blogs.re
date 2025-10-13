module Data = {
  let delay = 0.2;

  let get_file = filename => Blogs_content.read(filename);

  let data = Blogs_content.file_list;

  let get = () => data;

  let cached = ref(false);
  let destroy = () => cached := false;
  let promise = () => {
    cached.contents
      ? Lwt.return(data)
      : {
        let%lwt () = Lwt_unix.sleep(delay);
        cached.contents = true;
        Lwt.return(data);
      };
  };
};

module Blogs = {
  [@react.async.component]
  let make = () => {
    let blogs = React.Experimental.use(Data.promise());

    <div>
      {blogs
       |> List.mapi((i, comment) =>
            <p key={Int.to_string(i)}> {React.string(comment)} </p>
          )
       |> React.list}
    </div>;
  };
};

module Page = {
  [@react.component]
  let make = () => {
    <main>
      <article>
        <h1> {React.string("Blogs")} </h1>
        <section>
          <React.Suspense fallback={React.string("loading...")}>
            <Blogs />
          </React.Suspense>
        </section>
      </article>
    </main>;
  };
};

let handler = _request => {
  Dream.stream(
    ~headers=[("Content-Type", "text/html")],
    response_stream => {
      Data.destroy();

      let pipe = data => {
        let%lwt () = Dream.write(response_stream, data);
        Dream.flush(response_stream);
      };

      let (stream, _abort) =
        ReactDOM.renderToLwtStream(<Document> <Page /> </Document>);

      Lwt_stream.iter_s(pipe, stream);
    },
  );
};
