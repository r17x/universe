{
  lib,
  rustPlatform,
  fetchFromGitHub,
  nix-update-script,
}:

rustPlatform.buildRustPackage rec {
  pname = "komodo";
  version = "1.16.12";

  src = fetchFromGitHub {
    owner = "moghtech";
    repo = "komodo";
    tag = "v${version}";
    hash = "sha256-9/rp0DG66YQR8QXQTkhgfLGzWr2sRPejaGcJZc2zdh8=";
  };

  cargoHash = "sha256-Nl4yd7YN1Me3/8bjKWEa7VlUC4GbtN0gmfMMUMXUNPM=";

  # disable for check
  # > error: doctest failed, to rerun pass `-p komodo_client --doc`
  doCheck = false;

  passthru.updateScript = nix-update-script { };

  meta = {
    description = "a tool to build and deploy software on many servers";
    homepage = "https://komo.do";
    changelog = "https://github.com/moghtech/komodo/releases/tag/v${version}";
    mainProgram = "komodo";
    maintainers = with lib.maintainers; [ r17x ];
    license = lib.licenses.mit;
  };
}
