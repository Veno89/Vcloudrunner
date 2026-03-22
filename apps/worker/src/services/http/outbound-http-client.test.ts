import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { FetchOutboundHttpClient, OutboundHttpRequestError } = await import('./outbound-http-client.js');

test('FetchOutboundHttpClient forwards the request with an abort signal', async (t) => {
  const client = new FetchOutboundHttpClient();
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  t.mock.method(
    globalThis,
    'fetch',
    async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status: 200 });
    }
  );

  await client.request({
    url: 'https://example.test/resource',
    init: {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: 'payload'
    },
    timeoutMs: 2_000
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'https://example.test/resource');
  assert.equal(calls[0]?.init?.method, 'POST');
  assert.ok(calls[0]?.init?.signal instanceof AbortSignal);
});

test('FetchOutboundHttpClient normalizes timeout failures', async (t) => {
  const client = new FetchOutboundHttpClient();
  const timeoutHandle = { timeout: true } as unknown as ReturnType<typeof setTimeout>;

  t.mock.method(globalThis, 'setTimeout', (((handler: () => void) => {
    handler();
    return timeoutHandle;
  }) as unknown) as typeof setTimeout);
  t.mock.method(globalThis, 'clearTimeout', (() => undefined) as typeof clearTimeout);
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      if ((init?.signal as AbortSignal | undefined)?.aborted) {
        throw new Error('aborted by signal');
      }

      throw new Error('expected timeout abort');
    }
  );

  await assert.rejects(
    client.request({
      url: 'https://example.test/resource',
      timeoutMs: 10_000
    }),
    (error: unknown) =>
      error instanceof OutboundHttpRequestError &&
      error.timedOut &&
      error.message === 'request timed out after 10000ms'
  );
});

test('FetchOutboundHttpClient preserves non-timeout transport error messages', async (t) => {
  const client = new FetchOutboundHttpClient();

  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('socket hang up');
  });

  await assert.rejects(
    client.request({
      url: 'https://example.test/resource',
      timeoutMs: 2_000
    }),
    (error: unknown) =>
      error instanceof OutboundHttpRequestError &&
      !error.timedOut &&
      error.message === 'socket hang up'
  );
});
