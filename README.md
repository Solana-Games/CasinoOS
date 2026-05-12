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
- **Anchor on-chain escrow program**: `programs/casinoos_escrow/*` + `Anchor.toml`

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

## Solana Anchor escrow + commit-reveal settlement

New Anchor program scaffold (`programs/casinoos_escrow/src/lib.rs`) provides:

- Escrowed room-round betting
- Commit-reveal validation on settlement
- NFT multiplier field on bets (`nft_multiplier_bps`, validated bounds)
- Jackpot vault accumulation and payout trigger path
- Treasury fee/remainder sweep

### Integration bridge with existing JS modules

Use `src/solana/anchorRoundBridge.js` to map room events into Anchor instruction payloads:

```js
const {
  buildCreateRoundInstructionData,
  fromResolvedSyncedRound
} = require('./src/solana/anchorRoundBridge');

// from server-side pending round context
const createIxData = buildCreateRoundInstructionData({
  roundId: 42,
  serverSeed: 'secure-server-seed',
  minBetLamports: 1_000_000,
  closeSlot: 25_000
});

// from liveRooms resolved synced round event
const settleIxData = fromResolvedSyncedRound(resolvedRoundEvent);
```

### Optional local Anchor build

If Anchor CLI is installed:

```bash
npm run solana:anchor:build
```

Open UI mock:

```bash
xdg-open src/admin/index.html
```
