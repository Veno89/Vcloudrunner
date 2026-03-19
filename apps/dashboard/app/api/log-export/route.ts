import { type NextRequest } from 'next/server';
import {
  createDashboardProxyTimeoutMessage,
  createDashboardProxyUnavailableMessage,
  describeDashboardProxyFailure
} from '@/lib/helpers';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const apiAuthToken = process.env.API_AUTH_TOKEN;
const DASHBOARD_PROXY_TIMEOUT_MS = 10_000;

export async function GET(request: NextRequest) {
  if (!apiAuthToken) {
    return new Response(
      describeDashboardProxyFailure({
        feature: 'log export',
        hasApiAuthToken: false,
      }),
      { status: 401 }
    );
  }

  const projectId = request.nextUrl.searchParams.get('projectId');
  const deploymentId = request.nextUrl.searchParams.get('deploymentId');

  if (!projectId || !deploymentId) {
    return new Response('Missing projectId or deploymentId', { status: 400 });
  }

  const query = new URLSearchParams();
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');
  const format = request.nextUrl.searchParams.get('format');
  if (from) {
    query.set('from', from);
  }
  if (to) {
    query.set('to', to);
  }
  if (format === 'ndjson.gz') {
    query.set('format', format);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, DASHBOARD_PROXY_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(
      `${apiBaseUrl}/v1/projects/${projectId}/deployments/${deploymentId}/logs/export?${query.toString()}`,
      {
        headers: {
          authorization: `Bearer ${apiAuthToken}`
        },
        cache: 'no-store',
        signal: controller.signal
      }
    );
  } catch {
    return new Response(
      controller.signal.aborted
        ? createDashboardProxyTimeoutMessage('log export')
        : createDashboardProxyUnavailableMessage('log export'),
      { status: controller.signal.aborted ? 504 : 503 }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!upstream.ok) {
    const message = await upstream.text();
    return new Response(
      describeDashboardProxyFailure({
        feature: 'log export',
        hasApiAuthToken: true,
        statusCode: upstream.status,
        upstreamMessage: message,
      }),
      { status: upstream.status }
    );
  }

  if (!upstream.body) {
    return new Response('Upstream API log export returned an empty response body.', { status: 502 });
  }

  const fallbackType = format === 'ndjson.gz' ? 'application/gzip' : 'application/x-ndjson; charset=utf-8';
  const fallbackName = format === 'ndjson.gz' ? `deployment-${deploymentId}-logs.ndjson.gz` : `deployment-${deploymentId}-logs.ndjson`;
  const contentType = upstream.headers.get('content-type') ?? fallbackType;
  const disposition = upstream.headers.get('content-disposition') ?? `attachment; filename="${fallbackName}"`;

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-disposition': disposition,
      'cache-control': 'no-store'
    }
  });
}
