import { NextResponse } from 'next/server';
import { z } from 'zod';

const { executeSpin } = require('@/lib/gameService');
const { verifyAuthToken } = require('@/server/auth');

const spinSchema = z.object({
  userId: z.string().min(1),
  roomId: z.string().min(1).default('default'),
  betSol: z.number().positive().max(100),
  commitReveal: z.object({
    serverSeed: z.string().min(8),
    clientSeed: z.string().min(8),
    nonce: z.number().int().nonnegative(),
  }),
});

export async function POST(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    verifyAuthToken(token);
    const body = await request.json();
    const parsed = spinSchema.parse(body);
    const result = executeSpin(parsed);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || 'invalid request' }, { status: 400 });
  }
}
