import { type NextRequest } from 'next/server';
import { buildDashboardAuthHeaders } from '@/lib/api';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const DASHBOARD_PROXY_TIMEOUT_MS = 10_000;

export async function GET(request: NextRequest) {
  const requestAuth = getDashboardRequestAuth();

  if (!requestAuth.hasAnyAuth) {
    return new Response('Unauthorized', { status: 401 });
  }

  const projectId = request.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return new Response('Missing projectId', { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DASHBOARD_PROXY_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${apiBaseUrl}/v1/projects/${projectId}/environment-variables/export`,
      {
        headers: buildDashboardAuthHeaders(),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return new Response('Export failed', { status: response.status });
    }

    const content = await response.text();
    return new Response(content, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': 'attachment; filename=".env"',
      },
    });
  } catch {
    clearTimeout(timeoutId);
    return new Response('Export request failed', { status: 502 });
  }
}
