import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([
    {
      id: '1',
      createdAt: new Date().toISOString(),
      betSol: 1,
      payoutSol: 2.5,
      commitHash: 'demo-commit-hash-1',
    },
    {
      id: '2',
      createdAt: new Date(Date.now() - 60000).toISOString(),
      betSol: 0.5,
      payoutSol: 0,
      commitHash: 'demo-commit-hash-2',
    },
  ]);
}
