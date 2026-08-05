#!/usr/bin/env bash
# Deterministic copy: search ../../skills-bank/{built-in,custom}/skills/{name}/ → .claude/skills/{name}/
# Built-in skills take priority over custom skills with the same name.
set -euo pipefail

BUILTIN="../../skills-bank/built-in/skills"
CUSTOM="../../skills-bank/custom/skills"
DEST=".claude/skills"

# Check at least one skills directory exists (prefer built-in catalog for validation)
if [[ ! -d "$BUILTIN" ]] && [[ ! -d "$CUSTOM" ]]; then
  echo "Skills bank not found: searched $BUILTIN and $CUSTOM. Run from room cwd." >&2
  exit 1
fi

usage() {
  echo "Usage: wire.sh <skill-name> [skill-name …]" >&2
  echo "Copies skills from guild-house/data/skills-bank/{built-in,custom}/skills/ into this room's .claude/skills/." >&2
  exit 1
}

[[ $# -ge 1 ]] || usage

for name in "$@"; do
  if [[ ! "$name" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]]; then
    echo "Invalid skill name: $name" >&2
    exit 1
  fi

  # Search built-in first, then custom
  src=""
  if [[ -d "$BUILTIN/$name" ]] && [[ -f "$BUILTIN/$name/SKILL.md" ]]; then
    src="$BUILTIN/$name"
  elif [[ -d "$CUSTOM/$name" ]] && [[ -f "$CUSTOM/$name/SKILL.md" ]]; then
    src="$CUSTOM/$name"
  fi

  if [[ -z "$src" ]]; then
    echo "Skill not found in bank: $name (checked built-in/skills/$name and custom/skills/$name)" >&2
    exit 1
  fi

  mkdir -p "$DEST/$name"
  cp -r "$src/." "$DEST/$name/"
  echo "Wired: $name"
done