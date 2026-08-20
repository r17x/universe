{ inputs, prev }:
let
  system = prev.stdenv.hostPlatform.system;

  bunSrc = prev.fetchFromGitHub {
    owner = "oven-sh";
    repo = "bun";
    rev = "11a2e2c20b6746689298a1da76cec35b13d3405e";
    hash = "sha256-0CL+kaJQk6HxfKjZ5NROOkmg1eOfcIqLs95dXHmrCks=";
  };

  vendorDeps = [
    {
      name = "boringssl";
      owner = "oven-sh";
      repo = "boringssl";
      rev = "0c5fce43b7ed5eb6001487ee48ac65766f5ddcd1";
      hash = "sha256-8boP4RtW7cHdXge24A4v3nzVJad+SOAd3imTWtFB2AE=";
    }
    {
      name = "brotli";
      owner = "google";
      repo = "brotli";
      rev = "v1.1.0";
      hash = "sha256-MvceRcle2dSkkucC2PlsCizsIf8iv95d8Xjqew266wc=";
    }
    {
      name = "cares";
      owner = "c-ares";
      repo = "c-ares";
      rev = "3ac47ee46edd8ea40370222f91613fc16c434853";
      hash = "sha256-TDhwFF0/sLZT1aag6mTPBZfnh6iOYNO9lVuf+5eJAP0=";
    }
    {
      name = "hdrhistogram";
      owner = "HdrHistogram";
      repo = "HdrHistogram_c";
      rev = "be60a9987ee48d0abf0d7b6a175bad8d6c1585d1";
      hash = "sha256-9Xp+gPqJpB7xZr5dzyc9Via9gxG9q/EriCx3cm++0kU=";
      patches = [ "hdrhistogram/bitscan-type.patch" ];
    }
    {
      name = "highway";
      owner = "google";
      repo = "highway";
      rev = "2607d3b5b0113992fe84d3848859eae13b3b52c1";
      hash = "sha256-YUYZO9KLffczjwIz3mBBceD6oM1giLCFLDHgDCevdRA=";
      patches = [ "highway/silence-warnings.patch" ];
    }
    {
      name = "libarchive";
      owner = "libarchive";
      repo = "libarchive";
      rev = "ded82291ab41d5e355831b96b0e1ff49e24d8939";
      hash = "sha256-LpD+lE+0PZi/3nYDVPXhBQL9A7mvqelOzRLskVtg9Y0=";
      patches = [
        "libarchive/archive_write_add_filter_gzip.c.patch"
        "libarchive/nonblocking-read.patch"
      ];
    }
    {
      name = "libdeflate";
      owner = "ebiggers";
      repo = "libdeflate";
      rev = "c8c56a20f8f621e6a966b716b31f1dedab6a41e3";
      hash = "sha256-2TiV3kmFs9j4aYetoYeWg3+MoZ542/0zaD0hwn9b8ZA=";
    }
    {
      name = "libjpeg-turbo";
      owner = "libjpeg-turbo";
      repo = "libjpeg-turbo";
      rev = "e352b02f794f701407b39af08576035ba3360d60";
      hash = "sha256-mxmJejgUqS6OC0U0gHsHHe74X0MTVBY5OCbqxIyWa3Q=";
      patches = [
        "libjpeg-turbo/8bit-only.patch"
        "libjpeg-turbo/jbun_stubs.c"
      ];
    }
    {
      name = "libspng";
      owner = "randy408";
      repo = "libspng";
      rev = "fb768002d4288590083a476af628e51c3f1d47cd";
      hash = "sha256-BiRuPQEKVJYYgfUsglIuxrBoJBFiQ0ygQmAFrVvCz4Q=";
    }
    {
      name = "libuv";
      owner = "oven-sh";
      repo = "libuv";
      rev = "4dcfac4780d394e0dc2d3fb30335ca01b553eb46";
      hash = "sha256-abklWC0UAWDHOyCHDCbQvhdTKn6wZZCBDnwYGNUf+T0=";
      patches = [ "libuv/win-poll-rearm-before-callback.patch" ];
    }
    {
      name = "libwebp";
      owner = "webmproject";
      repo = "libwebp";
      rev = "b7e29b9d75bd31422b00c2a446d49d7af06c328d";
      hash = "sha256-7i4fGBTsTjAkBzCjVqXqX4n22j6dLgF/0mz4ajNA45U=";
    }
    {
      name = "lolhtml";
      owner = "cloudflare";
      repo = "lol-html";
      rev = "77127cd2b8545998756e8d64e36ee2313c4bb312";
      hash = "sha256-xmCynpziYvsWTEYQTF+85PqJ2QuC1oX/qAj513DVEGw=";
      patches = [ "lolhtml/0001-rlib-only.patch" ];
    }
    {
      name = "lshpack";
      owner = "litespeedtech";
      repo = "ls-hpack";
      rev = "8905c024b6d052f083a3d11d0a169b3c2735c8a1";
      hash = "sha256-Bv49X+smxjBCYofA1PJq7y/z10yEVqzUX3KU3XcymXM=";
      patches = [ "lshpack/bss-huff-tables.patch" ];
    }
    {
      name = "lsqpack";
      owner = "litespeedtech";
      repo = "ls-qpack";
      rev = "1e9c5b8e59f8161c54f168a570c8bfdc59ded0c3";
      hash = "sha256-se4UhI3bKu3sJZJMI5PD6HR0GOG5kr6+5Uj2vulhN74=";
      patches = [ "lsqpack/bss-huff-tables.patch" ];
    }
    {
      name = "lsquic";
      owner = "litespeedtech";
      repo = "lsquic";
      rev = "3181911301b1aa4f54c1ed690901abc674ee08fb";
      hash = "sha256-VY8f3nB1CQW1/jUJeDxtivtU3DZhi/E8g9T/JRUZ8Nk=";
      patches = [
        "lsquic/versions-to-string.patch"
        "lsquic/allow-no-sni.patch"
        "lsquic/skip-priority-walk.patch"
        "lsquic/disable-gquic.patch"
      ];
    }
    {
      name = "mimalloc";
      owner = "oven-sh";
      repo = "mimalloc";
      rev = "f15aecb94fc8096008bf87b90c53ed682026914a";
      hash = "sha256-gqElo2xDaqNcogaiJuBxV99tXD8JGgZuFImDxK/DhfE=";
    }
    {
      name = "picohttpparser";
      owner = "h2o";
      repo = "picohttpparser";
      rev = "066d2b1e9ab820703db0837a7255d92d30f0c9f5";
      hash = "sha256-5wQO5D4rA89mGohCuGtPBXFhTqpyHr3PmMzjTkYPTzw=";
    }
    {
      name = "tinycc";
      owner = "oven-sh";
      repo = "tinycc";
      rev = "12882eee073cfe5c7621bcfadf679e1372d4537b";
      hash = "sha256-KamQ6GJA0X3ME4+zFrH2X7lphQQeRako61If0QvHuxA=";
      patches = [ "tinycc/tcc.h.patch" ];
    }
    {
      name = "zlib";
      owner = "zlib-ng";
      repo = "zlib-ng";
      rev = "12731092979c6d07f42da27da673a9f6c7b13586";
      hash = "sha256-6GlHCnx9dQtmViPnvHnMS+l9Z+g6M8ynrSxLhLtmAKU=";
      patches = [ "zlib/clang-cl-arm64.patch" ];
    }
    {
      name = "zstd";
      owner = "facebook";
      repo = "zstd";
      rev = "f8745da6ff1ad1e7bab384bd1f9d742439278e99";
      hash = "sha256-tNFWIT9ydfozB8dWcmTMuZLCQmQudTFJIkSr0aG7S44=";
    }
  ];

  placeVendorDep =
    dep:
    let
      src = prev.fetchFromGitHub {
        inherit (dep)
          owner
          repo
          rev
          hash
          ;
      };
      patches = dep.patches or [ ];
    in
    ''
      echo "Placing vendor dep: ${dep.name}"
      mkdir -p vendor/${dep.name}
      cp -r ${src}/* vendor/${dep.name}/
      chmod -R u+w vendor/${dep.name}
      ${prev.lib.concatMapStringsSep "\n" (
        p:
        if prev.lib.hasSuffix ".patch" p then
          "cd vendor/${dep.name} && git apply --ignore-whitespace --ignore-space-change --no-index - < ../../patches/${p} && cd ../.."
        else
          "cp patches/${p} vendor/${dep.name}/"
      ) patches}
      # Compute .ref stamp: SHA256(commit [+ \0 + patch_content]...)[:16]
      bun -e "
        const crypto = require('crypto');
        const fs = require('fs');
        const h = crypto.createHash('sha256');
        h.update('${dep.rev}');
        const patches = [${prev.lib.concatMapStringsSep ", " (p: "'patches/${p}'") patches}];
        for (const p of patches) {
          h.update('\\0');
          h.update(fs.readFileSync(p, 'utf8').replace(/\\r\\n/g, '\\n'));
        }
        process.stdout.write(h.digest('hex').slice(0, 16));
      " > vendor/${dep.name}/.ref
    '';

  webkitPrebuilt = prev.fetchurl {
    url = "https://github.com/oven-sh/WebKit/releases/download/autobuild-5488984d20e0dbfe4be2c3ba8fb18eb81a5e0e8b/bun-webkit-macos-arm64.tar.gz";
    hash = "sha256-5IwO/WNkGCgE/zFFcG4/3g04HRtMaT0v80s0+iCkB0M=";
  };

  nodeHeaders = prev.fetchurl {
    url = "https://nodejs.org/dist/v24.3.0/node-v24.3.0-headers.tar.gz";
    hash = "sha256-BF6b9HfNXbDsZ/jBpjun94Te3+LFgePQ7Qm4jpEV3Qc=";
  };

  bunCodegen =
    prev.runCommand "bun-codegen"
      {
        nativeBuildInputs = [
          prev.bun
          prev.perl
        ];
        inherit bunSrc;
      }
      ''
        cp -r $bunSrc src
        chmod -R u+w src
        cd src

        # Install npm deps needed by cppbind.ts (lezer-cpp)
        bun install --frozen-lockfile 2>/dev/null || bun install || true

        mkdir -p build/release/codegen

        # generate-jssink.ts: standalone, only needs output dir
        bun run src/codegen/generate-jssink.ts build/release/codegen || true

        # generate-host-exports.ts: scans src/runtime + src/jsc .rs files
        bun run src/codegen/generate-host-exports.ts build/release/codegen || true

        # generate-classes.ts: needs class definition files + output dir
        bun run src/codegen/generate-classes.ts \
          $(find src -name '*.classes.ts' 2>/dev/null | sort) \
          build/release/codegen || true

        # bundle-modules.ts (generates generated_js2native.rs): needs --debug flag + buildDir
        bun run src/codegen/bundle-modules.ts --debug=OFF build/release || true

        # cppbind.ts: needs src dir, codegen dir, and cxx-sources list
        find src -name '*.cpp' | sort > build/release/codegen/cxx-sources.txt
        bun src/codegen/cppbind.ts src build/release/codegen \
          build/release/codegen/cxx-sources.txt || true

        # Ensure all 5 files exist (create empty stubs if codegen failed)
        for f in cpp.rs generated_classes.rs generated_js2native.rs generated_jssink.rs generated_host_exports.rs; do
          touch build/release/codegen/$f
        done

        mkdir -p $out
        cp build/release/codegen/*.rs $out/
      '';

  llvm21 = inputs.nixpkgs-master.legacyPackages.${system}.llvmPackages_21;

  rustBin = inputs.rust-overlay.lib.mkRustBin { } prev;
  rustNightly = rustBin.nightly."2026-05-06".default.override {
    extensions = [ "rust-src" ];
  };
in
llvm21.stdenv.mkDerivation {
  pname = "bun";
  version = "1.2.16";

  src = bunSrc;

  nativeBuildInputs = [
    prev.bun
    prev.ninja
    prev.cmake
    rustNightly
    llvm21.clang
    llvm21.llvm
    prev.git
    prev.perl
    prev.python3
    prev.apple-sdk_15
    prev.sqlite.dev
  ];

  buildInputs = [
    prev.darwin.ICU
  ];

  postUnpack = ''
    # Make source writable
    chmod -R u+w $sourceRoot
    cd $sourceRoot

    # Place codegen files
    mkdir -p build/release/codegen
    cp ${bunCodegen}/*.rs build/release/codegen/
    chmod -R u+w build/release/codegen

    # Symlink for build.rs (expects build/debug/codegen)
    mkdir -p build/debug
    ln -s ../release/codegen build/debug/codegen

    # Place all vendored deps with patches and .ref stamps
    ${prev.lib.concatMapStringsSep "\n" placeVendorDep vendorDeps}

    # Extract WebKit prebuilt to cache dir
    # build.ts expects: cacheDir/webkit-<version16>-arm64/
    # Tarball has top-level bun-webkit/ dir that must be hoisted
    mkdir -p .cache/webkit-5488984d20e0dbfe-arm64
    tar xzf ${webkitPrebuilt} -C .cache/webkit-5488984d20e0dbfe-arm64 --strip-components=1
    # Remove conflicting headers (matches rmAfterExtract in bun's build system)
    echo -n "5488984d20e0dbfe4be2c3ba8fb18eb81a5e0e8b" > .cache/webkit-5488984d20e0dbfe-arm64/.identity

    # Extract Node.js headers to cache dir
    # build.ts expects: cacheDir/nodejs-headers-24.3.0/
    # Tarball has top-level node-v24.3.0/ dir that must be hoisted
    mkdir -p .cache/nodejs-headers-24.3.0
    tar xzf ${nodeHeaders} -C .cache/nodejs-headers-24.3.0 --strip-components=1
    # Remove headers that conflict with BoringSSL / our libuv
    rm -rf .cache/nodejs-headers-24.3.0/include/node/openssl
    rm -rf .cache/nodejs-headers-24.3.0/include/node/uv
    rm -f .cache/nodejs-headers-24.3.0/include/node/uv.h
    echo -n "24.3.0" > .cache/nodejs-headers-24.3.0/.identity

    # Install npm deps needed by build.ts
    bun install --frozen-lockfile 2>/dev/null || bun install || true

    cd ..
  '';

  buildPhase = ''
    runHook preBuild

    # Set up writable dirs for Rust toolchain
    export CARGO_HOME=$TMPDIR/cargo
    export RUSTUP_HOME=$TMPDIR/rustup
    mkdir -p $CARGO_HOME $RUSTUP_HOME

    # Point build system to macOS 15 SDK (minimum SDK 13.0 required)
    export DEVELOPER_DIR=${prev.apple-sdk_15}
    # Provide git revision without requiring .git directory
    export GIT_SHA=11a2e2c20b6746689298a1da76cec35b13d3405e

    # Prepend LLVM 21 tools to PATH so bun's toolchain finder picks
    # clang-21/clang++-21 over the stdenv's clang wrapper
    export PATH=${llvm21.clang}/bin:${llvm21.llvm}/bin:$PATH

    # Run bun's build system
    bun scripts/build.ts --profile=release --cacheDir=$PWD/.cache

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin
    cp build/release/bun $out/bin/bun

    runHook postInstall
  '';

  postFixup = ''
    local resolv_path
    resolv_path=$(otool -L $out/bin/bun | grep -o '/nix/store/[^ ]*/libresolv[^ ]*' | head -1)
    if [ -n "$resolv_path" ]; then
      install_name_tool -change \
        "$resolv_path" \
        "/usr/lib/libresolv.9.dylib" \
        $out/bin/bun
    fi
  '';

  postPatch = ''
    # Remove -Wl,-ld_new linker flag that only works with Apple's Xcode linker.
    # The Nix cctools ld64 misinterprets it as "-l d_new" (link library).
    substituteInPlace scripts/build/flags.ts \
      --replace-fail '"-Wl,-ld_new", ' ""

    # Static-link LLVM 21's libc++ to avoid /nix/store runtime dependency.
    # This embeds __hash_memory and other newer ABI symbols into the binary.
    # Also merge __DATA_DIRTY into __DATA for bun --compile compatibility.
    substituteInPlace scripts/build/flags.ts \
      --replace-fail '"-Wl,-no_compact_unwind"' '"-nostdlib++", "-Wl,-force_load,${llvm21.libcxx}/lib/libc++.a", "-Wl,-rename_section,__DATA_DIRTY,__data,__DATA,__dirty_data", "-Wl,-no_compact_unwind"'

    # Strip debug info to reduce build size (saves ~10GB disk during compilation)
    substituteInPlace scripts/build/flags.ts \
      --replace-fail 'flag: "-gdwarf-4",' 'flag: "-g0",' \
      --replace-fail 'flag: "-g1",' 'flag: "-g0",' \
      --replace-fail 'flag: "-glldb",' 'flag: "",'

    # Disable debuginfo in Rust release profile to save disk
    substituteInPlace Cargo.toml \
      --replace-fail 'debug = "line-tables-only"' 'debug = 0'
  '';

  dontConfigure = true;
  doCheck = false;
}
