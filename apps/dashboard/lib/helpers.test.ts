import { describe, expect, it } from 'vitest';
import {
  slugifyProjectName,
  extractApiStatusCode,
  deriveApiErrorKind,
  truncateUuid,
  hasRequestedCancellation,
  formatDeploymentStatusText
} from './helpers';

describe('dashboard helpers', () => {
  describe('slugifyProjectName', () => {
    it('lowercases and replaces spaces with hyphens', () => {
      expect(slugifyProjectName('My Awesome Project')).toBe('my-awesome-project');
    });

    it('strips non-alphanumeric characters', () => {
      expect(slugifyProjectName('Hello World! 123 @#$')).toBe('hello-world-123');
    });

    it('collapses multiple spaces or hyphens into one', () => {
      expect(slugifyProjectName('a   b---c')).toBe('a-b-c');
    });

    it('trims leading and trailing hyphens', () => {
      expect(slugifyProjectName('---hello---')).toBe('hello');
    });
  });

  describe('extractApiStatusCode', () => {
    it('extracts status code from API_REQUEST_FAILED message', () => {
      expect(extractApiStatusCode(new Error('API_REQUEST_FAILED 404'))).toBe(404);
      expect(extractApiStatusCode(new Error('API_REQUEST_FAILED 500: Internal error'))).toBe(500);
    });

    it('returns null if pattern is not matched', () => {
      expect(extractApiStatusCode(new Error('Network error'))).toBe(null);
    });

    it('returns null if input is not an Error', () => {
      expect(extractApiStatusCode('API_REQUEST_FAILED 404')).toBe(null);
      expect(extractApiStatusCode(null)).toBe(null);
    });
  });

  describe('deriveApiErrorKind', () => {
    it('maps known status codes to specific categories', () => {
      expect(deriveApiErrorKind(400)).toBe('invalid_input');
      expect(deriveApiErrorKind(401)).toBe('auth_required');
      expect(deriveApiErrorKind(403)).toBe('access_denied');
      expect(deriveApiErrorKind(404)).toBe('not_found');
      expect(deriveApiErrorKind(409)).toBe('conflict');
    });

    it('falls back to unavailable for unknown or null status codes', () => {
      expect(deriveApiErrorKind(500)).toBe('unavailable');
      expect(deriveApiErrorKind(503)).toBe('unavailable');
      expect(deriveApiErrorKind(200)).toBe('unavailable');
      expect(deriveApiErrorKind(null)).toBe('unavailable');
    });
  });

  describe('truncateUuid', () => {
    it('truncates UUIDs down to the first segment with an ellipsis', () => {
      expect(truncateUuid('12345678-0000')).toBe('12345678…');
    });

    it('leaves short strings untouched', () => {
      expect(truncateUuid('short')).toBe('short');
      expect(truncateUuid('123456789012')).toBe('123456789012');
    });
  });

  describe('hasRequestedCancellation', () => {
    it('returns true if cancellation.requestedAt is a non-empty string', () => {
      expect(hasRequestedCancellation({ cancellation: { requestedAt: '2023-01-01' } })).toBe(true);
    });

    it('returns false if cancellation is missing or requestedAt is empty/missing', () => {
      expect(hasRequestedCancellation({})).toBe(false);
      expect(hasRequestedCancellation({ cancellation: {} })).toBe(false);
      expect(hasRequestedCancellation({ cancellation: { requestedAt: '   ' } })).toBe(false);
      expect(hasRequestedCancellation(null)).toBe(false);
    });
  });

  describe('formatDeploymentStatusText', () => {
    it('appends cancelling state to queued and building', () => {
      expect(formatDeploymentStatusText('queued', true)).toBe('queued / cancelling');
      expect(formatDeploymentStatusText('building', true)).toBe('building / cancelling');
    });

    it('returns pure status text if cancellation is not requested or status is immutable', () => {
      expect(formatDeploymentStatusText('queued', false)).toBe('queued');
      expect(formatDeploymentStatusText('running', true)).toBe('running');
      expect(formatDeploymentStatusText('stopped', true)).toBe('stopped');
    });
  });
});
