let
  icons = {
    # suggest me with devicons from nerdfonts
    language.vim = "";
    language.neovim = "";
    language.org = "";
    language.reason = "";

    circleLeft = "";
    circleLeft1 = "";
    circleRight = "";
    circleRight1 = "";
    hint = "";
    info = "ℹ";
    info1 = "";
    info2 = "";
    warning = "";
    warning1 = "";
    warning2 = "";
    warning3 = "";
    cross = "";
    cross1 = "";
    cross2 = "";
    cross3 = "";
    cross4 = "";
    plus = "";
    plus1 = "";
    plus2 = "洛";
    plus3 = "";
    plus4 = "⊕";
    minus = "";
    minus1 = "";
    minus2 = "";
    minus3 = "";
    refresh = "";
    file = "";
    reload = "";
    bookmark = "";
    word = "";
    recent = "";
    notes = "";
    lightning = "";
    org = "";
    still = "";
    camera = "";
    nix = "";
    function = "";
    code = "󰘦 ";
    wand = " ";
    house = "";
    robotFace = " ";
    journal = "";
    git = " ";
    gearSM = "⛭";
    markdown = "";
    checkmark = "✔";
    chevronRight = "";
    chevronDown = "";
    chevronLeft = "";
    chevronUp = "";
    folder = "";
    folderOpen = "";
    philosopher = "🧘";
    package = "";
    telescope = "";
    freeBSD = "";
    linux = "";
    archlinux = "";
    resource = "";
    terminal = "";
    cloud = "";
    database = "";
    server = "";
    settings = "";
    gear = "";
    rocket = "";
    bug = "";
    face = "󰏚 ";
    lightbulb = "";
    star = "";
    indent = "▎";
  };
in
icons
// {
  withIcon = iconName: s: "${icons.${iconName}} ${s}";
  space = {
    right = i: "${icons.${i}} ";
    left = i: " ${icons.${i}}";
  };
}
