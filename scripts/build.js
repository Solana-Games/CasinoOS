const fs = require('node:fs');

const payload = {
  system: 'Scatter Solana Casino OS',
  status: 'built',
  timestamp: new Date().toISOString(),
  modules: ['slot-engine', 'rtp-ai', 'rooms', 'game-registry', 'admin']
};

fs.writeFileSync('build-status.json', JSON.stringify(payload, null, 2));
console.log('✅ Build status generated');
