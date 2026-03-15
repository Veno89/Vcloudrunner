import { NextResponse } from 'next/server';
import { fetchQueueHealth } from '@/lib/api';

export async function GET() {
  try {
    const health = await fetchQueueHealth();
    return NextResponse.json(health, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        status: 'unavailable',
        message: 'Unable to fetch queue health snapshot.',
      },
      { status: 200 }
    );
  }
}
