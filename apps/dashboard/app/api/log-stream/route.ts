import { type NextRequest } from 'next/server';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const apiAuthToken = process.env.API_AUTH_TOKEN;

export async function GET(request: NextRequest) {
  if (!apiAuthToken) {
    return new Response('Missing API auth token', { status: 401 });
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

  const upstream = await fetch(
    `${apiBaseUrl}/v1/projects/${projectId}/deployments/${deploymentId}/logs/stream?${query.toString()}`,
    {
      headers: {
        authorization: `Bearer ${apiAuthToken}`
      },
      cache: 'no-store'
    }
  );

  if (!upstream.ok || !upstream.body) {
    const message = await upstream.text();
    return new Response(message || 'Upstream log stream failed', { status: upstream.status });
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
