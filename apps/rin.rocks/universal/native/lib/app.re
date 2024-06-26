[@react.component]
let make = (~serverUrl) => {
  let url = ReasonReactRouter.useUrl(~serverUrl, ());

  switch (url) {
  | {path: [""], hash: _, search: _} => <Home />
  | {path: ["blog"], hash: _, search: _} => <Blog />
  | _ => <Notfound />
  };
};
