#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Deploying Scatter Solana Casino..."

if command -v vercel >/dev/null 2>&1; then
  vercel --prod
else
  echo "⚠️ vercel CLI not installed, skipping web deployment"
fi

if command -v anchor >/dev/null 2>&1; then
  anchor build
  anchor deploy --provider.cluster devnet
else
  echo "⚠️ anchor CLI not installed, skipping Solana deployment"
fi

echo "🎰 Deployment flow complete"
