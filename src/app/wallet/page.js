'use client';

import { useState } from 'react';

export default function WalletPage() {
  const [status, setStatus] = useState('Disconnected');

  const connect = async () => {
    if (!window.solana?.isPhantom) {
      setStatus('Phantom not installed');
      return;
    }
    const response = await window.solana.connect();
    setStatus(`Connected: ${response.publicKey.toString()}`);
  };

  return (
    <main className="mx-auto min-h-screen max-w-4xl p-8 text-white">
      <h1 className="text-4xl font-black text-amber-300">Wallet Connect</h1>
      <p className="mt-2 text-cyan-200">Phantom wallet integration</p>
      <button className="mt-6 rounded-lg border border-amber-300 px-5 py-3" onClick={connect}>Connect Phantom</button>
      <p className="mt-4">{status}</p>
    </main>
  );
}
