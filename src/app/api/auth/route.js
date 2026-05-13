import { NextResponse } from 'next/server';
import { z } from 'zod';
const { issueAuthToken, nonceForWallet } = require('@/server/auth');

const authRequestSchema = z.object({
  wallet: z.string().min(1),
  userId: z.string().min(1).default('demo-user'),
});

export async function POST(request) {
  try {
    const { wallet, userId } = authRequestSchema.parse(await request.json());
    const providerToken = request.headers.get('x-auth-provider-token');
    const expectedProviderToken = process.env.AUTH_PROVIDER_TOKEN;
    const requiresTrustedProvider = process.env.NODE_ENV === 'production';
    if (requiresTrustedProvider) {
      if (!expectedProviderToken || providerToken !== expectedProviderToken) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
    }

    const adminKey = request.headers.get('x-admin-key');
    const isAdminRequest =
      wallet === 'admin' &&
      process.env.ADMIN_API_KEY &&
      adminKey &&
      adminKey === process.env.ADMIN_API_KEY;
    const nonce = nonceForWallet(wallet || 'unknown');
    const token = issueAuthToken({ userId, wallet, role: isAdminRequest ? 'admin' : 'player' });
    return NextResponse.json({ nonce, token });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'invalid request' }, { status: 400 });
  }
}
