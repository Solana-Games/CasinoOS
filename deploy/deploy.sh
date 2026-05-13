#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/5] Installing dependencies"
npm ci

echo "[2/5] Generating Prisma client"
npx prisma generate

echo "[3/5] Running tests"
npm test

echo "[4/5] Building web app"
npm run build

echo "[5/5] Building Anchor program"
cargo build --workspace --release

echo "Deployment bundle built successfully."
