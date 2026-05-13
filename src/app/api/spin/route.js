import { NextResponse } from 'next/server';

const { executeSpin } = require('@/lib/gameService');

export async function POST(request) {
  const body = await request.json();
  const result = executeSpin(body);
  return NextResponse.json(result);
}
