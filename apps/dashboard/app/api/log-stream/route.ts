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
        feature: 'live log streaming',
        hasApiAuthToken: false,
      }),
      { status: 401 }
    );
  }

  const projectId = request.nextUrl.searchParams.get('projectId');
  const deploymentId = request.nextUrl.searchParams.get('deploymentId');
  const after = request.nextUrl.searchParams.get('after');

  if (!projectId || !deploymentId) {
    return new Response('Missing projectId or deploymentId', { status: 400 });
  }

  const query = new URLSearchParams();
  if (after) {
    query.set('after', after);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, DASHBOARD_PROXY_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(
      `${apiBaseUrl}/v1/projects/${projectId}/deployments/${deploymentId}/logs/stream?${query.toString()}`,
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
        ? createDashboardProxyTimeoutMessage('live log streaming')
        : createDashboardProxyUnavailableMessage('live log streaming'),
      { status: controller.signal.aborted ? 504 : 503 }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!upstream.ok) {
    const message = await upstream.text();
    return new Response(
      describeDashboardProxyFailure({
        feature: 'live log streaming',
        hasApiAuthToken: true,
        statusCode: upstream.status,
        upstreamMessage: message,
      }),
      { status: upstream.status }
    );
  }

  if (!upstream.body) {
    return new Response('Upstream API live log streaming returned an empty response body.', { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive'
    }
  });
}
