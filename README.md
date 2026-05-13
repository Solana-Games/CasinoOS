# CasinoOS — Scatter Solana Casino Operating System

Production-oriented full-stack Solana casino platform with a premium **Scatter Solana** slot experience, commit-reveal provable fairness, adaptive RTP AI, multiplayer synchronized rooms, and an Anchor escrow settlement layer.

## Highlights

- **Next.js 14 App Router frontend** (`src/app`) with dark luxury neon styling
- **Anchor escrow program** (`programs/casinoos_escrow`) for SOL custody + settlement
- **Provably fair commit-reveal RNG** (engine + bridge + tests)
- **Adaptive RTP AI engine** bounded to **90%-98%**
- **5x4 slot engine** with wild/scatter symbols, free spins, big/mega win logic
- **Multiplayer room sync** with pooled jackpots
- **Admin control plane** (`src/admin/index.html`) for RTP, fees, game toggles, jackpots
- **Prisma + PostgreSQL schema** for users, bets, rooms, jackpots, transactions
- **API routes** for auth, spin, bet, jackpot, history
- **CI pipeline**, bootstrap, deploy scripts, and Docker image

---

## Repository Structure

```
.github/workflows/ci.yml
.gitignore
Anchor.toml
Cargo.toml
Dockerfile
config/.env.example
deploy/deploy.sh
package.json
programs/casinoos_escrow/
  Cargo.toml
  src/lib.rs
scripts/
  bootstrap.sh
  build.js
  test-engine.js
src/
  admin/index.html
  ai/rtpEngine.js
  engine/commitRevealRng.js
  engine/slotEngine.js
  games/registry.js
  rooms/liveRooms.js
  server/auth.js
  server/control.js
  solana/anchorRoundBridge.js
  app/
    layout.js
    page.js
    globals.css
    dashboard/page.js
    wallet/page.js
    history/page.js
    api/{auth,bet,spin,history,jackpot}/route.js
  components/SlotBoard.js
  lib/{prisma.js,gameService.js,socket.js}
prisma/schema.prisma
tests/*.test.js
```

---

## Core Architecture

### 1) Frontend (Next.js 14)

- Main game UI lives in `src/components/SlotBoard.js` rendered by `src/app/page.js`
- Design language: dark neon purple + gold + teal
- 3-column gaming frame:
  - Left: multiplier + free spins
  - Center: 5x4 reels + MEGA WIN overlay
  - Right: jackpot panel (Grand, Major, Minor, Mini)
- Bottom controls: balance, bet controls, SPIN action
- Additional pages:
  - `/dashboard`
  - `/wallet` (Phantom connect)
  - `/history`

### 2) Engine & Fairness

- `src/engine/commitRevealRng.js`
  - deterministic SHA-256 commit generation
  - reveal stream generation for reproducible RNG
  - verification helper
- `src/engine/slotEngine.js`
  - 5 reels × 4 rows
  - weighted symbols, wild/scatter support
  - free-spin trigger logic
  - line payout + big/mega win flags
- `src/ai/rtpEngine.js`
  - adaptive RTP targeting with strict 90-98 bounds

### 3) Multiplayer + Jackpot

- `src/rooms/liveRooms.js`
  - `prepareSyncedRound`
  - `resolveSyncedRound`
  - pooled jackpot contributions + trigger payout path
- `src/lib/socket.js`
  - Socket.io event handlers for room join/leave/prepare/resolve

### 4) Backend Control + Auth

- `src/server/auth.js`
  - JWT issuance and verification
  - nonce utility for wallet challenge prep
- `src/server/control.js`
  - admin RTP override
  - fee controls
  - game enable/disable controls
  - jackpot tier management

### 5) Solana/Anchor Layer

- `programs/casinoos_escrow/src/lib.rs`:
  - house initialization/configuration
  - NFT multiplier registry
  - escrowed bet placement
  - commit-reveal verification on settle
  - payout + jackpot vault flow
- `src/solana/anchorRoundBridge.js`:
  - round payload preparation for program calls
  - anchor RPC settlement helper

### 6) Persistence

- Prisma schema in `prisma/schema.prisma` defines:
  - Users
  - Bets
  - Rooms
  - Jackpot tiers
  - Transactions

---

## Security Model

- Commit-reveal prevents post-bet outcome manipulation
- House controls bounded by explicit validation checks
- RTP clamped between 90% and 98%
- JWT-based role separation (player/admin)
- Program-level input guards for:
  - bet limits
  - payout caps
  - arithmetic overflow
  - replay prevention via round state

> Note: Before mainnet launch, complete third-party audit, formal threat modeling, and high-coverage integration tests against Solana devnet/testnet.

---

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- Rust toolchain
- Solana CLI + Anchor (for on-chain workflows)
- PostgreSQL

### Setup

```bash
cp config/.env.example .env
bash scripts/bootstrap.sh
```

### Run

```bash
npm run dev
```

### Validate

```bash
npm test
npm run build
cargo check --workspace
```

---

## Deployment

### CI

GitHub Actions (`.github/workflows/ci.yml`) runs:

- `npm ci`
- `npm test`
- `npm run build`
- `cargo check --workspace`

### Scripted build deploy

```bash
bash deploy/deploy.sh
```

### Docker

```bash
docker build -t casinoos .
docker run -p 3000:3000 --env-file .env casinoos
```

---

## API Surface (Current)

- `POST /api/auth` — auth token + nonce
- `POST /api/spin` — execute slot round
- `POST /api/bet` — bet payload endpoint
- `GET /api/history` — history sample feed
- `GET /api/jackpot` — jackpot tiers

---

## Testing

Node test suite covers:

- RNG commit/reveal behavior
- Slot engine shape and payout invariants
- Live room prepare/resolve flows
- Auth token lifecycle
- Control-plane guardrails
- Anchor bridge payload formatting

---

## Roadmap to Mainnet Readiness

1. Replace mock API persistence with full Prisma-backed transactions
2. Add wallet signature verification challenge flow
3. Add full Anchor integration tests and devnet e2e settlement
4. Implement full admin auth + RBAC middleware in API routes
5. Add observability stack (metrics/traces/audit logs)
6. Add rate limits, anti-abuse controls, and KYC/geofence if required by jurisdiction

---

## License

MIT
