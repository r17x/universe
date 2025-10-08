[%styled.global
  {|
    :root {
      --background0: #000;
      --background1: #444;
      --background2: #888;
      --background3: #999;
      --foreground0: #fff;
      --foreground1: #ddd;
      --foreground2: #bbb;
    }
|}
];

[@react.component]
let make = () =>
  <>
    <link rel="preconnect" href="https://cdn.jsdelivr.net" />
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@webtui/css@0.0.5/dist/full.css"
    />
    {switch%platform (Runtime.platform) {
     | Server => <CSS.style_tag />
     | Client => React.null
     }}
  </>;
