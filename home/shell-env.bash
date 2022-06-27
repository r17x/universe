set -e
declare -x OUTER_PATH="$PATH"
declare -x outer="$out"
mkdir -p $outer

function mk_setenv() { 
  awk '/declare -x/{sub("declare -x", "setenv");sub(/=/, " ");print}'
}

cat <<EOF > $outer/input-derivation
#!$SHELL
source $shell_input_derivation
unset buildPhase
declare -x phases=nobuildPhase
declare -x nobuildPhase=true
declare -x IN_NIX_SHELL=impure
source \$stdenv/setup
export > $outer/shell-vars
EOF

env -i $SHELL --norc --noprofile -e -x "$outer/input-derivation"

(

# Variables that should never be set
for vname in \
  phases buildPhase nobuildPhase out shell shellHook stdenv \
  HOME USER LOGNAME DISPLAY TERM \
  IN_NIX_SHELL NIX_BUILD_TOP NIX_BUILD_SHELL NIX_ENFORCE_PURITY \
  TZ PAGER SHELL SHLVL TMP TMPDIR TEMP TEMPDIR OLDPWD PWD SHELL
do
cat <<EOF
function ${vname}_add() {
  :
}
EOF
done


# Variables that are always commulative with values from previous shells
for vname in \
PATH XDG_DATA_DIRS LD_LIBRARY_PATH LIBRARY_PATH \
PKG_CONFIG_PATH GOPATH NODE_PATH CLASSPATH
do
cat <<EOF
if [ "\$(type -t path_add)" = function ]; then
  function ${vname}_add () { 
    path_add $vname "\${@}" 
  }
fi
EOF
done

cat <<'EOF'
function setenv() {
  local name
  local value
  name="$1";
  value="$2";
  if [ "$(type -t "${name}_add")" = function ]; then
    "${name}_add" "$value"
  else
    export "$name"="$value"
  fi
}

EOF
cat "$outer/shell-vars" | mk_setenv 
cat <<'EOF'
if [ -n "$shellHook" ]; then
  $shellHook
fi
EOF
) >  "$outer/env"


set +e
