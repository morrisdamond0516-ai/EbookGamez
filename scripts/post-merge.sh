#!/bin/bash
set -e

for p in /nix/var/nix/profiles/default/bin /home/runner/.nix-profile/bin; do
  [ -x "$p/node" ] && export PATH="$p:$PATH" && break
done

if ! command -v node &>/dev/null; then
  NODE_PATH=$(ls -d /nix/store/*nodejs*/bin 2>/dev/null | head -1)
  [ -n "$NODE_PATH" ] && export PATH="$NODE_PATH:$PATH"
fi

export PATH="/home/runner/workspace/node_modules/.bin:$PATH"

if command -v node &>/dev/null; then
  drizzle-kit push --force
else
  echo "Node.js not available in post-merge environment, skipping db push"
fi
