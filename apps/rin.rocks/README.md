# **Rin.rocks**

Personal website [@r17x](https://github.com/r17x) for multi-purpose.

> 🚧 under construction - rebuild with [OCaml](https://ocaml.org)


## **Development**

This project need [opam](https://opam.ocaml.org/) known as OCaml package manager for manage dependencies and [dune](https://dune.build/install) for build system (make with style).


If you are enjoy with [Nix](#nix), you could be use nix development aka `nix-shell`.

### **Nix**

Currently, nix only provide opam and dune. (impure development environment)
```bash
# in project directory
nix develop .#ocaml

# or
$ nix develop github:r17x/universe#ocaml

# finally
eval (opam env)
```


#### Install Dependencies
```bash
eval (opam env)

opam install . -y

# or per project environment
opam switch create . 5.1.1 -y
```

#### Run server

```bash
dune exec ./server/server.exe
```
