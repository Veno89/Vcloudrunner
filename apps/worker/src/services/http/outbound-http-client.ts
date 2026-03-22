function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export interface OutboundHttpRequest {
  url: string;
  init?: Omit<RequestInit, 'signal'>;
  timeoutMs: number;
}

export class OutboundHttpRequestError extends Error {
  readonly timedOut: boolean;

  constructor(input: { timedOut: boolean; message: string; cause?: unknown }) {
    super(input.message);
    this.name = 'OutboundHttpRequestError';
    this.timedOut = input.timedOut;
    this.cause = input.cause;
  }
}

export interface OutboundHttpClient {
  request(input: OutboundHttpRequest): Promise<Response>;
}

export class FetchOutboundHttpClient implements OutboundHttpClient {
  async request(input: OutboundHttpRequest): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, input.timeoutMs);

    try {
      return await fetch(input.url, {
        ...input.init,
        signal: controller.signal
      });
    } catch (error) {
      throw new OutboundHttpRequestError({
        timedOut: controller.signal.aborted,
        message: controller.signal.aborted
          ? `request timed out after ${input.timeoutMs}ms`
          : getErrorMessage(error),
        cause: error
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
