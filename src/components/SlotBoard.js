'use client';

import { useMemo, useState } from 'react';

const defaultGrid = [
  ['K', 'Q', 'A', 'J', 'K'],
  ['🟪', '👑', 'A', '🟡', '🟪'],
  ['👑', '👑', '🟪', 'J', 'A'],
  ['K', 'Q', 'A', 'J', '🟡'],
];

export default function SlotBoard() {
  const [grid, setGrid] = useState(defaultGrid);
  const [bet, setBet] = useState(1);
  const [balance, setBalance] = useState(258.25);
  const [freeSpins, setFreeSpins] = useState(12);
  const [multiplier, setMultiplier] = useState(25);
  const [result, setResult] = useState({ payoutSol: 245.8, megaWin: true });

  const jackpots = useMemo(
    () => ({ grand: 1000, major: 250, minor: 50, mini: 10 }),
    []
  );

  async function spin() {
    const authRes = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wallet: 'demo-wallet', userId: 'demo-player' }),
    });
    const authData = await authRes.json();
    const body = {
      betSol: bet,
      commitReveal: {
        clientSeed: crypto.randomUUID(),
        nonce: Math.floor(Date.now() / 1000),
      },
      roomId: 'lobby',
      userId: 'demo-player',
    };

    const response = await fetch('/api/spin', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${authData.token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    setGrid(data.grid);
    setResult({ payoutSol: data.payoutSol, megaWin: data.megaWin });
    setBalance((v) => Number((v - bet + data.payoutSol).toFixed(2)));
    setFreeSpins(data.freeSpins);
    setMultiplier(Math.max(1, Math.floor(data.payoutSol / Math.max(0.1, bet))));
  }

  return (
    <main className="min-h-screen bg-cosmic px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl neon-panel rounded-2xl p-4 md:p-6">
        <header className="mb-4 text-center">
          <h1 className="text-4xl font-black tracking-widest text-amber-300">SCATTER SOLANA</h1>
          <p className="text-cyan-300">Provably fair, on-chain secured, AI-adaptive RTP</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[220px_1fr_220px]">
          <aside className="neon-panel rounded-xl p-4">
            <p className="text-sm text-amber-300">TOTAL MULTIPLIER</p>
            <p className="text-5xl font-black text-violet-300">x{multiplier}</p>
            <div className="mt-6 rounded-lg border border-teal-400/60 p-3">
              <p className="text-sm text-teal-300">FREE SPINS</p>
              <p className="text-3xl font-bold">{freeSpins} / 12</p>
            </div>
          </aside>

          <div className="relative neon-panel rounded-xl p-3">
            <div className="grid grid-cols-5 gap-2">
              {grid.flat().map((symbol, idx) => (
                <div key={idx} className="reel-cell">{symbol}</div>
              ))}
            </div>
            {result.megaWin && (
              <div className="win-overlay absolute inset-0 grid place-items-center bg-black/25">
                <div className="text-center">
                  <p className="text-5xl font-black text-fuchsia-300">MEGA WIN</p>
                  <p className="text-7xl font-black text-amber-300">{result.payoutSol.toFixed(1)} SOL</p>
                  <p className="text-4xl font-bold text-violet-200">INCREDIBLE!</p>
                </div>
              </div>
            )}
          </div>

          <aside className="neon-panel rounded-xl p-4">
            <p className="text-center text-3xl font-black text-amber-300">JACKPOT</p>
            {Object.entries(jackpots).map(([name, amount]) => (
              <div key={name} className="mt-2 flex justify-between rounded border border-amber-300/40 px-2 py-1 uppercase">
                <span>{name}</span>
                <span>{amount.toFixed(2)} SOL</span>
              </div>
            ))}
            <div className="mt-5 text-center">
              <p className="text-lg text-cyan-200">WIN</p>
              <p className="text-5xl font-black text-amber-200">{result.payoutSol.toFixed(1)} SOL</p>
            </div>
          </aside>
        </section>

        <footer className="mt-5 grid gap-3 rounded-xl border border-amber-300/40 bg-black/40 p-3 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-center">
          <div>
            <p className="text-xs">BALANCE</p>
            <p className="text-3xl font-black">{balance.toFixed(2)} SOL</p>
          </div>
          <button className="rounded-lg border border-amber-300/60 px-4 py-2" onClick={() => setBet((v) => Math.max(0.1, v - 0.1))}>-</button>
          <div className="text-center">
            <p className="text-xs">BET</p>
            <p className="text-2xl font-bold">{bet.toFixed(2)} SOL</p>
          </div>
          <button className="rounded-lg border border-amber-300/60 px-4 py-2" onClick={() => setBet((v) => Number((v + 0.1).toFixed(2)))}>+</button>
          <button className="spin-button px-10 py-4 text-3xl" onClick={spin}>SPIN</button>
        </footer>
      </div>
    </main>
  );
}
