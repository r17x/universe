type config;

[@mel.module "@tamagui/core"]
external createTamagui: 'a => config = "createTamagui";
[@mel.module "@tamagui/config/v3"] external config: 'config = "config";
let defaultConfig = createTamagui(config);

module Provider = {
  [@mel.module "@tamagui/core"] [@react.component]
  external make: (~config: config, ~children: React.element) => React.element =
    "TamaguiProvider";
};

module Theme = {
  [@mel.module "tamagui"] [@react.component]
  external make: (~name: string, ~children: React.element) => React.element =
    "Theme";
};

module Avatar = {
  [@mel.module "tamagui"] [@react.component]
  external make:
    (~children: React.element=?, ~circular: bool=?, ~size: string=?) =>
    React.element =
    "Avatar";
};

module AvatarImage = {
  [@mel.module "tamagui"] [@mel.scope "Avatar"] [@react.component]
  external make: (~src: string, ~accessibilityLabel: string) => React.element =
    "Image";
};

module AvatarFallback = {
  [@mel.module "tamagui"] [@mel.scope "Avatar"] [@react.component]
  external make: (~delayMs: int=?, ~backgroundColor: string=?) => React.element =
    "Fallback";
};

module Header = {
  [@mel.module "tamagui"] [@react.component]
  external make: (~children: React.element=?) => React.element = "Header";
};

module H1 = {
  [@mel.module "tamagui"] [@react.component]
  external make: (~children: React.element) => React.element = "H1";
};

module Anchor = {
  [@mel.module "tamagui"] [@react.component]
  external make:
    (
      ~href: string=?,
      ~target: string=?,
      ~rel: string=?,
      ~children: React.element=?
    ) =>
    React.element =
    "Anchor";
};

module Paragraph = {
  [@mel.module "tamagui"] [@react.component]
  external make:
    (~size: string=?, ~fontWeight: string=?, ~children: React.element) =>
    React.element =
    "Paragraph";
};

module SizableText = {
  [@mel.module "tamagui"] [@react.component]
  external make:
    (~size: string=?, ~fontWeight: string=?, ~children: React.element) =>
    React.element =
    "SizableText";
};

module Separator = {
  [@mel.module "tamagui"] [@react.component]
  external make:
    (
      ~size: string=?,
      ~px: string=?,
      ~py: string=?,
      ~mx: string=?,
      ~my: string=?,
      ~vertical: bool=?,
      ~children: React.element=?
    ) =>
    React.element =
    "Separator";
};

module XStack = {
  [@mel.module "tamagui"] [@react.component]
  external make:
    (
      ~space: string=?,
      ~px: string=?,
      ~py: string=?,
      ~mx: string=?,
      ~my: string=?,
      ~ai: string=?,
      ~jc: string=?,
      ~alignSelf: string=?,
      ~children: React.element=?
    ) =>
    React.element =
    "XStack";
};

module YStack = {
  [@mel.module "tamagui"] [@react.component]
  external make:
    (
      ~space: string=?,
      ~px: string=?,
      ~py: string=?,
      ~mx: string=?,
      ~my: string=?,
      ~ai: string=?,
      ~jc: string=?,
      ~alignSelf: string=?,
      ~children: React.element=?
    ) =>
    React.element =
    "YStack";
};

module View = {
  [@mel.module "tamagui"] [@react.component]
  external make:
    (
      ~px: string=?,
      ~py: string=?,
      ~mx: string=?,
      ~my: string=?,
      ~ai: string=?,
      ~jc: string=?,
      ~alignSelf: string=?,
      ~h: string=?,
      ~bg: string=?,
      ~children: React.element
    ) =>
    React.element =
    "View";
};
