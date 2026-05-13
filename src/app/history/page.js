import { headers } from 'next/headers';

async function resolveBaseUrl() {
  const configured = process.env.NEXT_SERVER_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (configured) return configured;
  const incoming = await headers();
  const host = incoming.get('x-forwarded-host') || incoming.get('host');
  const proto = incoming.get('x-forwarded-proto') || 'http';
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

async function getHistory() {
  const response = await fetch(`${await resolveBaseUrl()}/api/history`, { cache: 'no-store' });
  if (!response.ok) return [];
  return response.json();
}

export default async function HistoryPage() {
  const rows = await getHistory();

  return (
    <main className="mx-auto min-h-screen max-w-4xl p-8 text-white">
      <h1 className="mb-4 text-4xl font-black text-amber-300">Spin History</h1>
      <div className="overflow-hidden rounded-xl border border-violet-400/50">
        <table className="w-full bg-black/30 text-left">
          <thead className="bg-violet-900/40 text-amber-200">
            <tr>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Bet</th>
              <th className="px-4 py-2">Payout</th>
              <th className="px-4 py-2">Commit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-violet-500/30">
                <td className="px-4 py-2">{row.createdAt}</td>
                <td className="px-4 py-2">{row.betSol}</td>
                <td className="px-4 py-2">{row.payoutSol}</td>
                <td className="px-4 py-2 font-mono text-xs">{row.commitHash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
