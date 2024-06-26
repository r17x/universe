[@react.component]
let make = (~children, ~scripts=[]) => {
  <html>
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title> {React.string("Rin.rocks")} </title>
      <link rel="shortcut icon" href="https://github.com/r17x.png" />
      <script src="https://cdn.tailwindcss.com" />
    </head>
    <body>
      <div id="root"> children </div>
      {scripts |> List.map(src => <script src />) |> React.list}
    </body>
  </html>;
};
