import {
  requestApi,
  buildDashboardAuthHeaders,
  normalizeQueueHealthPayload,
  normalizeWorkerHealthPayload,
  getErrorMessage
} from './client';
import type { ApiQueueHealth, ApiWorkerHealth, ApiServiceHealth } from './types';

export async function fetchQueueHealth(): Promise<ApiQueueHealth> {
  try {
    const response = await requestApi('/health/queue', {
      headers: buildDashboardAuthHeaders()
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return normalizeQueueHealthPayload(payload, `API_REQUEST_FAILED ${response.status}`);
    }

    return normalizeQueueHealthPayload(payload, 'Queue health payload unavailable.');
  } catch (error) {
    return {
      status: 'unavailable',
      message: getErrorMessage(error)
    };
  }
}

export async function fetchWorkerHealth(): Promise<ApiWorkerHealth> {
  try {
    const response = await requestApi('/health/worker', {
      headers: buildDashboardAuthHeaders()
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return normalizeWorkerHealthPayload(payload, `API_REQUEST_FAILED ${response.status}`);
    }

    return normalizeWorkerHealthPayload(payload, 'Worker health payload unavailable.');
  } catch (error) {
    return {
      status: 'unavailable',
      message: getErrorMessage(error)
    };
  }
}

export async function fetchApiHealth(): Promise<ApiServiceHealth> {
  try {
    const response = await requestApi('/health');

    if (!response.ok) {
      const fallback = await response.json().catch(() => ({}));
      return {
        status: 'unavailable',
        message: typeof fallback?.message === 'string' ? fallback.message : `API_REQUEST_FAILED ${response.status}`
      };
    }

    const payload = await response.json().catch(() => ({} as { status?: string; message?: string }));
    return {
      status: payload.status === 'ok' ? 'ok' : 'unavailable',
      ...(typeof payload.message === 'string' ? { message: payload.message } : {})
    };
  } catch (error) {
    return {
      status: 'unavailable',
      message: getErrorMessage(error)
    };
  }
}
