# Scatter Solana Casino OS

Production-focused scaffold for a modular, blockchain-native casino platform.

## Included modules

- **Slot engine**: `src/engine/slotEngine.js` (5x4 reels, free-spins trigger, jackpot threshold)
- **AI RTP controller**: `src/ai/rtpEngine.js` (adaptive 90–98 RTP)
- **Multiplayer rooms**: `src/rooms/liveRooms.js` (room create/join/spin + jackpot pool)
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

Open UI mock:

```bash
xdg-open src/admin/index.html
```
