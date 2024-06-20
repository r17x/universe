{ src }:

{ buildDunePackage
, ppxlib
, melange
, reason
, reason-native
, ocaml_pcre
, lwt
, lwt_ppx
, uri
, quickjs
, ...
}:

buildDunePackage {
  name = "server-reason-react";
  pname = "server-reason-react";
  version = "r/a";
  inherit src;
  propagatedBuildInputs = [
    melange
    ppxlib
    ocaml_pcre
    lwt
    lwt_ppx
    uri
    quickjs
  ];
  nativeBuildInputs = [
    reason
    melange
    reason-native.refmterr
  ];
}

