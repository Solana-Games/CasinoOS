import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    grand: 1000,
    major: 250,
    minor: 50,
    mini: 10,
  });
}
