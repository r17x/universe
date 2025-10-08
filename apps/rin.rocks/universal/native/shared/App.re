[@react.component]
let make = () =>
  <>
    <Box>
      <Text.H1 alt="it's me r17x and you can call me Rin">
        {"r17x (Rin)" |> React.string}
      </Text.H1>
      <Text.Paragraph>
        <Text.Code> {"Software Engineer" |> React.string} </Text.Code>
        {"Interest in topic (φ + Losophy), (λ + μετα-Programming), D.x (Developer Experience), & Web Tech. "
         |> React.string}
      </Text.Paragraph>
    </Box>
    <div>
      <hr className=[%cx {|margin-top: 2ch;|}] />
      <Text.H2> {"List Projects" |> React.string} </Text.H2>
      <ul>
        <li> {"..." |> React.string} </li>
        <li> {"..." |> React.string} </li>
        <li> {"..." |> React.string} </li>
      </ul>
    </div>
  </>;
