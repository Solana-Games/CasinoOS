import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const { executeSpin } = require('@/lib/gameService');
const { verifyAuthToken } = require('@/server/auth');

const spinSchema = z.object({
  userId: z.string().min(1),
  roomId: z.string().min(1).default('default'),
  betSol: z.number().positive().max(100),
  commitReveal: z.object({
    clientSeed: z.string().min(8),
    nonce: z.number().int().nonnegative(),
  }),
});

export async function POST(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const authPayload = verifyAuthToken(token);
    const body = await request.json();
    const parsed = spinSchema.parse(body);
    const result = executeSpin({
      ...parsed,
      userId: authPayload.sub,
      commitReveal: {
        ...parsed.commitReveal,
        serverSeed: crypto.randomBytes(32).toString('hex'),
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'invalid request' }, { status: 400 });
  }
}
