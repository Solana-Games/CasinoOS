import { NextResponse } from 'next/server';
const { issueAuthToken, nonceForWallet } = require('@/server/auth');

export async function POST(request) {
  const { wallet, userId = 'demo-user' } = await request.json();
  const adminKey = request.headers.get('x-admin-key');
  const isAdminRequest =
    wallet === 'admin' &&
    process.env.ADMIN_API_KEY &&
    adminKey &&
    adminKey === process.env.ADMIN_API_KEY;
  const nonce = nonceForWallet(wallet || 'unknown');
  const token = issueAuthToken({ userId, wallet, role: isAdminRequest ? 'admin' : 'player' });
  return NextResponse.json({ nonce, token });
}
