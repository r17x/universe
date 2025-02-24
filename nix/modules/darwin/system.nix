{
  # Auto upgrade nix package and the daemon service.
  security.pam.enableSudoTouchIdAuth = false;
  # dock
  system.defaults.dock.autohide = true;
  system.defaults.dock.mru-spaces = false;
  system.defaults.dock.showhidden = true;
  # keyboard UI
  system.defaults.NSGlobalDomain.AppleKeyboardUIMode = 3;
  services.karabiner-elements.enable = false;

  # finder
  system.defaults.finder.AppleShowAllExtensions = true;
  system.defaults.finder.QuitMenuItem = true;
  system.defaults.finder.FXEnableExtensionChangeWarning = false;
  # trackpad
  system.defaults.trackpad.Clicking = true;
  system.defaults.trackpad.TrackpadThreeFingerDrag = false;
  # Keyboard
  system.keyboard.enableKeyMapping = true;
  system.keyboard.remapCapsLockToEscape = true;

}
