[@react.component]
let make = (~children, ~script=?) => {
  <html>
    <head>
      <title> {React.string("Rin.rocks - If you know, you know!")} </title>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="shortcut icon" href="https://github.com/r17x.png" />
      <GlobalStyles />
      {switch (script) {
       | None => React.null
       | Some(src) => <script type_="module" src />
       }}
    </head>
    <body> <div id="root"> children </div> </body>
  </html>;
};
