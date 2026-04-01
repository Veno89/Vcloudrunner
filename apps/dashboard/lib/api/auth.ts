import { cache } from 'react';
import { getDashboardRequestAuth } from '../dashboard-session';

import { buildAuthHeaders, requestApi, putJson } from './client';
import type { ApiDataResponse, ApiViewerContext } from './types';

interface ViewerContextFetchResult {
  viewer: ApiViewerContext | null;
  statusCode: number | null;
}

interface UpsertViewerProfileInput {
  name: string;
  email: string;
}

const fetchViewerContextByAuth = cache(async (
  bearerToken: string | null,
  demoUserIdValue: string | null
): Promise<ViewerContextFetchResult> => {
  const response = await requestApi('/v1/auth/me', {
    headers: buildAuthHeaders({
      bearerToken,
      demoUserId: demoUserIdValue
    })
  });

  if (response.status === 401 || response.status === 403) {
    return {
      viewer: null,
      statusCode: response.status
    };
  }

  if (!response.ok) {
    throw new Error(`API_REQUEST_FAILED ${response.status}`);
  }

  const payload = await response.json() as ApiDataResponse<ApiViewerContext>;
  return {
    viewer: payload.data,
    statusCode: response.status
  };
});

export async function fetchViewerContext(): Promise<ApiViewerContext | null> {
  const auth = getDashboardRequestAuth();
  const result = await fetchViewerContextByAuth(auth.bearerToken, auth.demoUserId);
  return result.viewer;
}

export async function resolveViewerContext(): Promise<{
  viewer: ApiViewerContext | null;
  error: unknown | null;
  statusCode: number | null;
}> {
  const auth = getDashboardRequestAuth();

  try {
    const result = await fetchViewerContextByAuth(auth.bearerToken, auth.demoUserId);

    return {
      viewer: result.viewer,
      error:
        result.viewer || result.statusCode === null
          ? null
          : new Error(`API_REQUEST_FAILED ${result.statusCode}`),
      statusCode: result.statusCode
    };
  } catch (error) {
    return {
      viewer: null,
      error,
      statusCode:
        error instanceof Error
          ? Number.parseInt(error.message.match(/API_REQUEST_FAILED\s+(\d+)/)?.[1] ?? '', 10) || null
          : null
    };
  }
}

export async function fetchViewerContextForBearerToken(
  bearerToken: string
): Promise<ApiViewerContext | null> {
  const trimmedToken = bearerToken.trim();

  if (trimmedToken.length === 0) {
    return null;
  }

  const result = await fetchViewerContextByAuth(trimmedToken, null);
  return result.viewer;
}

export async function upsertViewerProfile(
  input: UpsertViewerProfileInput
): Promise<ApiViewerContext> {
  const response = await putJson<ApiDataResponse<ApiViewerContext>>('/v1/auth/me/profile', {
    name: input.name,
    email: input.email
  });

  return response.data;
}
