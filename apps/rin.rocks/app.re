open Ui;

let config = defaultConfig;

module Hero = {
  [@react.component]
  let make = () => {
    <XStack space="$8" ai="center">
      <Avatar circular=true size="$12">
        <AvatarImage
          src="https://github.com/r17x.png"
          accessibilityLabel="Rin"
        />
        <AvatarFallback backgroundColor="$purple10" />
      </Avatar>
      <YStack space="$2">
        <YStack>
          <H1> {React.string("Rin")} </H1>
          <SizableText size="$6">
            {React.string(
               {j|Software Engineer, Interest in topic (φ + Losophy), (λ + μετα-Programming), D.x (Developer Experience), & Web Tech.|j},
             )}
          </SizableText>
        </YStack>
        <Separator my="$2" />
        <XStack>
          <Anchor
            target="_blank"
            rel="noopener noreferrer"
            href="https://twitter.com/__r17x">
            <Paragraph size="$6"> "Twitter"->React.string </Paragraph>
          </Anchor>
          <Separator vertical=true mx="$4" />
          <Anchor
            target="_blank"
            rel="noopener noreferrer"
            href="https://github.com/r17x">
            <Paragraph size="$6"> "GitHub"->React.string </Paragraph>
          </Anchor>
          <Separator vertical=true mx="$4" />
          <Anchor
            target="_blank"
            rel="noopener noreferrer"
            href="https://read.cv/r17x">
            <Paragraph size="$6"> "CV"->React.string </Paragraph>
          </Anchor>
        </XStack>
      </YStack>
    </XStack>;
  };
};

[@react.component]
let make = () =>
  <Provider config>
    <Theme name="dark">
      <View bg="black" h="100vh" ai="center" py="$8">
        <Header> <Hero /> </Header>
      </View>
    </Theme>
  </Provider>;
