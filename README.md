# Scatter Solana Casino OS

Production-focused scaffold for a modular, blockchain-native casino platform.

## Included modules

- **Slot engine**: `src/engine/slotEngine.js` (5x4 reels, free-spins trigger, jackpot threshold)
- **Provably fair RNG utility**: `src/engine/commitRevealRng.js` (server-seed commit + deterministic reveal stream)
- **AI RTP controller**: `src/ai/rtpEngine.js` (adaptive 90–98 RTP)
- **Multiplayer rooms**: `src/rooms/liveRooms.js` (room create/join/spin + synced commit-reveal rounds + jackpot pool)
- **Game plugin registry**: `src/games/registry.js` (slots, dice, roulette, crash, blackjack + dynamic register)
- **Admin/auth/control**: `src/server/*` (default admin credentials and RTP override snapshot)
- **Casino UI mock screen**: `src/admin/index.html` (dark luxury 5x4 interface)
- **CI/CD**: `.github/workflows/ci.yml`
- **Build/bootstrap/deploy scripts**: `scripts/*`, `deploy/deploy.sh`

## Default admin credentials

- Email: `admin@admin.com`
- Password: `admin123`

Override via environment variables from `config/.env.example`.
In production (`NODE_ENV=production`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_SECRET` must be set to non-default values.
Optional admin token lifetime can be configured via `ADMIN_TOKEN_TTL_MS`.

## Local usage

```bash
npm ci
npm test
npm run build
```

## Commit-reveal RNG integration

`spinGrid` supports deterministic commit-reveal inputs for verifiable rounds:

```js
const { createCommit } = require('./src/engine/commitRevealRng');
const { spinGrid } = require('./src/engine/slotEngine');

const serverSeed = 'secure-server-seed';
const commitHash = createCommit(serverSeed); // publish commit hash pre-round

const grid = spinGrid({
  commitReveal: {
    serverSeed,       // reveal post-round
    clientSeed: 'player-seed',
    nonce: 1
  }
});
```

## Multiplayer synced round integration

`liveRooms` supports a two-step room round for synchronized spins:

```js
const { prepareSyncedRound, resolveSyncedRound } = require('./src/rooms/liveRooms');

const pending = prepareSyncedRound('room-1', 'client-seed-shared');
// broadcast pending.commitHash to players before reveal

const result = resolveSyncedRound('room-1', pending.roundId, { p1: 2, p2: 3 }, 1);
// result includes shared grid, commit hash, reveal seeds, per-player outcomes, and jackpot payout info
```

Open UI mock:

```bash
xdg-open src/admin/index.html
```
