[%%mel.raw {|import '@tamagui/core/reset.css'|}];

switch (ReactDOM.querySelector("#app")) {
| None =>
  Js.Console.error("Failed to start React: couldn't find the #app element")
| Some(root) =>
  let root = ReactDOM.Client.createRoot(root);
  ReactDOM.Client.render(
    root,
    <React.StrictMode> <App /> </React.StrictMode>,
  );
};
