import { NextResponse } from 'next/server';
const { issueAuthToken, nonceForWallet } = require('@/server/auth');

export async function POST(request) {
  const { wallet, userId = 'demo-user' } = await request.json();
  const nonce = nonceForWallet(wallet || 'unknown');
  const token = issueAuthToken({ userId, wallet, role: wallet === 'admin' ? 'admin' : 'player' });
  return NextResponse.json({ nonce, token });
}
