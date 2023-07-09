_final: prev: {
  luajitPackages = prev.luajitPackages // {
    luafun = prev.luajitPackages.buildLuarocksPackage {
      pname = "fun";
      version = "scm-1";

      src = prev.fetchgit (removeAttrs
        (prev.lib.importJSON ./lua/luafun.json) [ "date" "path" ]);

      disabled = with prev.lua; (prev.luajitPackages.luaOlder "5.1") || (prev.luajitPackages.luaAtLeast "5.4");
      propagatedBuildInputs = [ prev.lua ];

      meta = {
        homepage = "https://luafun.github.io/";
        description = "High-performance functional programming library for Lua";
        license.fullName = "MIT/X11";
      };
    };
  };
}
