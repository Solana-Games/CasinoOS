#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f config/.env.example ]]; then
  echo "Missing config/.env.example" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  cp config/.env.example .env
  echo "Created .env from config/.env.example"
fi

echo "Installing npm dependencies"
npm install

echo "Generating Prisma client"
npx prisma generate

echo "Bootstrap complete."
