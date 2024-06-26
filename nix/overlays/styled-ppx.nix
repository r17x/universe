{ src
, buildDunePackage
, melange
, reason
, reason-react
, reason-react-ppx
, reason-native
, server-reason-react
, sedlex
, ppx_deriving
, menhir
, ppx_deriving_yojson
, ppx_yojson_conv_lib
, ppxlib
, yojson
, findlib
, ...
}:

buildDunePackage {
  pname = "styled-ppx";
  version = "0.54.1";
  inherit src;
  propagatedBuildInputs = [
    findlib
    ppxlib
    ppx_deriving
    ppx_deriving_yojson
    ppx_yojson_conv_lib
    yojson
    server-reason-react
    melange
    sedlex
  ];
  nativeBuildInputs = [
    findlib
    ppxlib
    menhir
    sedlex
    menhir
    ppx_deriving
    ppx_deriving_yojson
    yojson

    ppxlib

    reason
    reason-react
    reason-react-ppx
    server-reason-react
    reason-native.refmterr
  ];
}

