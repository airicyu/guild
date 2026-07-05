#!/usr/bin/env bash
# Deterministic copy: ../../skills-bank/{name}/ → .claude/skills/{name}/
set -euo pipefail

BANK="../../skills-bank"
DEST=".claude/skills"

if [[ ! -f "$BANK/catalog.md" ]]; then
  echo "Skills bank not found: $BANK (expected catalog.md). Run from room cwd." >&2
  exit 1
fi

usage() {
  echo "Usage: wire.sh <skill-name> [skill-name …]" >&2
  echo "Copies guild-house/data/skills-bank skills into this room's .claude/skills/." >&2
  exit 1
}

[[ $# -ge 1 ]] || usage

for name in "$@"; do
  if [[ ! "$name" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]]; then
    echo "Invalid skill name: $name" >&2
    exit 1
  fi
  src="$BANK/$name"
  if [[ ! -d "$src" ]]; then
    echo "Skill not found in bank: $name ($src)" >&2
    exit 1
  fi
  if [[ ! -f "$src/SKILL.md" ]]; then
    echo "Skill missing SKILL.md: $name" >&2
    exit 1
  fi
  mkdir -p "$DEST/$name"
  cp -r "$src/." "$DEST/$name/"
  echo "Wired: $name"
done
