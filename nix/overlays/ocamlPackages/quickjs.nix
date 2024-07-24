{ src
, buildDunePackage
, ctypes
, integers
, ...
}:

buildDunePackage {
  name = "quickjs";
  pname = "quickjs";
  version = "0.1.1";
  inherit src;
  propagatedBuildInputs = [ integers ctypes ];
}

