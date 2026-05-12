#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Bootstrapping Scatter Casino..."
npm ci --ignore-scripts
node scripts/build.js
npm test

echo "✅ System ready"
