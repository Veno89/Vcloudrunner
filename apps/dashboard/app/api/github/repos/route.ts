import { NextResponse } from 'next/server';
import { fetchInstallationRepos } from '@/lib/api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const installationIdParam = searchParams.get('installationId');

  if (!installationIdParam) {
    return NextResponse.json({ error: 'installationId is required' }, { status: 400 });
  }

  const installationId = Number(installationIdParam);
  if (!Number.isInteger(installationId) || installationId <= 0) {
    return NextResponse.json({ error: 'Invalid installationId' }, { status: 400 });
  }

  try {
    const repos = await fetchInstallationRepos(installationId);
    return NextResponse.json({ repos }, { status: 200 });
  } catch {
    return NextResponse.json({ repos: [], error: 'Failed to fetch repos' }, { status: 200 });
  }
}
