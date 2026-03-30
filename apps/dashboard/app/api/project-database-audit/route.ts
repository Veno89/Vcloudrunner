import { type NextRequest } from 'next/server';
import {
  buildDashboardAuthHeaders
} from '@/lib/api';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import {
  createDashboardProxyTimeoutMessage,
  createDashboardProxyUnavailableMessage,
  describeDashboardProxyFailure
} from '@/lib/helpers';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const DASHBOARD_PROXY_TIMEOUT_MS = 10_000;

export async function GET(request: NextRequest) {
  const requestAuth = getDashboardRequestAuth();

  if (!requestAuth.hasAnyAuth) {
    return new Response(
      describeDashboardProxyFailure({
        feature: 'database audit export',
        requestAuth,
      }),
      { status: 401 }
    );
  }

  const projectId = request.nextUrl.searchParams.get('projectId');
  const databaseId = request.nextUrl.searchParams.get('databaseId');

  if (!projectId || !databaseId) {
    return new Response('Missing projectId or databaseId', { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, DASHBOARD_PROXY_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(
      `${apiBaseUrl}/v1/projects/${projectId}/databases/${databaseId}/audit/export`,
      {
        headers: buildDashboardAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal
      }
    );
  } catch {
    return new Response(
      controller.signal.aborted
        ? createDashboardProxyTimeoutMessage('database audit export')
        : createDashboardProxyUnavailableMessage('database audit export'),
      { status: controller.signal.aborted ? 504 : 503 }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!upstream.ok) {
    const message = await upstream.text();
    return new Response(
      describeDashboardProxyFailure({
        feature: 'database audit export',
        requestAuth,
        statusCode: upstream.status,
        upstreamMessage: message,
      }),
      { status: upstream.status }
    );
  }

  if (!upstream.body) {
    return new Response('Upstream API database audit export returned an empty response body.', { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') ?? 'application/json; charset=utf-8';
  const disposition =
    upstream.headers.get('content-disposition') ?? `attachment; filename="project-database-${databaseId}-audit.json"`;

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-disposition': disposition,
      'cache-control': 'no-store'
    }
  });
}
