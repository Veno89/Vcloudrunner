import { getDashboardRequestAuth, type DashboardRequestAuth } from '../dashboard-session';

import type { ApiQueueHealth, ApiWorkerHealth } from './types';

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
export const demoUserId = process.env.NEXT_PUBLIC_DEMO_USER_ID;
export const apiAuthToken = process.env.API_AUTH_TOKEN;
const DASHBOARD_API_TIMEOUT_MS = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function normalizeQueueHealthPayload(
  payload: unknown,
  fallbackMessage: string
): ApiQueueHealth {
  if (!isRecord(payload)) {
    return {
      status: 'unavailable',
      message: fallbackMessage
    };
  }

  const status =
    payload.status === 'ok' || payload.status === 'degraded' || payload.status === 'unavailable'
      ? payload.status
      : 'unavailable';

  const counts = isRecord(payload.counts)
    ? {
        waiting: typeof payload.counts.waiting === 'number' ? payload.counts.waiting : 0,
        active: typeof payload.counts.active === 'number' ? payload.counts.active : 0,
        completed: typeof payload.counts.completed === 'number' ? payload.counts.completed : 0,
        failed: typeof payload.counts.failed === 'number' ? payload.counts.failed : 0,
        delayed: typeof payload.counts.delayed === 'number' ? payload.counts.delayed : 0,
        paused: typeof payload.counts.paused === 'number' ? payload.counts.paused : 0,
        prioritized: typeof payload.counts.prioritized === 'number' ? payload.counts.prioritized : 0
      }
    : undefined;

  return {
    status,
    ...(typeof payload.redis === 'string' ? { redis: payload.redis } : {}),
    ...(typeof payload.queue === 'string' ? { queue: payload.queue } : {}),
    ...(counts ? { counts } : {}),
    ...(typeof payload.sampledAt === 'string' ? { sampledAt: payload.sampledAt } : {}),
    message: typeof payload.message === 'string' ? payload.message : fallbackMessage
  };
}

export function normalizeWorkerHealthPayload(
  payload: unknown,
  fallbackMessage: string
): ApiWorkerHealth {
  if (!isRecord(payload)) {
    return {
      status: 'unavailable',
      message: fallbackMessage
    };
  }

  const status =
    payload.status === 'ok' || payload.status === 'stale' || payload.status === 'unavailable'
      ? payload.status
      : 'unavailable';

  return {
    status,
    ...(typeof payload.heartbeatKey === 'string' ? { heartbeatKey: payload.heartbeatKey } : {}),
    ...(typeof payload.staleAfterMs === 'number' ? { staleAfterMs: payload.staleAfterMs } : {}),
    ...(typeof payload.ageMs === 'number' ? { ageMs: payload.ageMs } : {}),
    ...(typeof payload.timestamp === 'string' ? { timestamp: payload.timestamp } : {}),
    ...(typeof payload.service === 'string' ? { service: payload.service } : {}),
    ...(typeof payload.pid === 'number' || payload.pid === null ? { pid: payload.pid } : {}),
    message: typeof payload.message === 'string' ? payload.message : fallbackMessage
  };
}

export function buildAuthHeaders(
  auth: Pick<DashboardRequestAuth, 'bearerToken' | 'demoUserId'>,
  extra?: Record<string, string>
): Record<string, string> {
  const headers = extra ? { ...extra } : {};

  if (auth.bearerToken) {
    headers.authorization = `Bearer ${auth.bearerToken}`;
  }

  if (auth.demoUserId) {
    headers['x-user-id'] = auth.demoUserId;
  }

  return headers;
}

export function buildDashboardAuthHeaders(
  extra?: Record<string, string>
): Record<string, string> {
  return buildAuthHeaders(getDashboardRequestAuth(), extra);
}

export async function requestApi(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, DASHBOARD_API_TIMEOUT_MS);

  try {
    return await fetch(`${apiBaseUrl}${path}`, {
      cache: 'no-store',
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    throw controller.signal.aborted
      ? new Error(`API request timed out after ${DASHBOARD_API_TIMEOUT_MS}ms`)
      : new Error(getErrorMessage(error));
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await requestApi(path, {
    headers: buildDashboardAuthHeaders()
  });

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await requestApi(path, {
    method: 'POST',
    headers: buildDashboardAuthHeaders({
      'content-type': 'application/json'
    }),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function putJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await requestApi(path, {
    method: 'PUT',
    headers: buildDashboardAuthHeaders({
      'content-type': 'application/json'
    }),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function patchJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await requestApi(path, {
    method: 'PATCH',
    headers: buildDashboardAuthHeaders({
      'content-type': 'application/json'
    }),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function deleteRequest(path: string): Promise<void> {
  const response = await requestApi(path, {
    method: 'DELETE',
    headers: buildDashboardAuthHeaders()
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }
}
