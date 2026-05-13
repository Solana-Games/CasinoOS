export default function DashboardPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl p-8 text-white">
      <h1 className="mb-4 text-4xl font-black text-amber-300">Player Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <section className="neon-panel rounded-xl p-4">
          <h2 className="text-lg text-cyan-200">Wallet Balance</h2>
          <p className="mt-2 text-3xl font-bold">258.25 SOL</p>
        </section>
        <section className="neon-panel rounded-xl p-4">
          <h2 className="text-lg text-cyan-200">Total Winnings</h2>
          <p className="mt-2 text-3xl font-bold">1,842.90 SOL</p>
        </section>
        <section className="neon-panel rounded-xl p-4">
          <h2 className="text-lg text-cyan-200">Current RTP</h2>
          <p className="mt-2 text-3xl font-bold">95.4%</p>
        </section>
      </div>
    </main>
  );
}
