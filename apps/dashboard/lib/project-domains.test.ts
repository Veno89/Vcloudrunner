import { describe, expect, it } from 'vitest';
import {
  formatProjectRouteStatusLabel,
  projectRouteStatusVariant,
  sortProjectDomainsForDisplay,
  projectDomainClaimVariant
} from './project-domains';
import type { ApiProjectDomain } from './api';

describe('project domain helpers', () => {
  describe('projectRouteStatusVariant', () => {
    it('returns success for active', () => {
      expect(projectRouteStatusVariant('active')).toBe('success');
    });

    it('returns warning for degraded and pending', () => {
      expect(projectRouteStatusVariant('degraded')).toBe('warning');
      expect(projectRouteStatusVariant('pending')).toBe('warning');
    });

    it('returns destructive for unavailable', () => {
      expect(projectRouteStatusVariant('unavailable')).toBe('destructive');
    });

    it('returns secondary for stale', () => {
      expect(projectRouteStatusVariant('stale')).toBe('secondary');
    });
  });

  describe('formatProjectRouteStatusLabel', () => {
    it('returns formatted text for each route status', () => {
      expect(formatProjectRouteStatusLabel('active')).toBe('route active');
      expect(formatProjectRouteStatusLabel('degraded')).toBe('route degraded');
      expect(formatProjectRouteStatusLabel('stale')).toBe('route stale');
      expect(formatProjectRouteStatusLabel('unavailable')).toBe('route unavailable');
      expect(formatProjectRouteStatusLabel('pending')).toBe('route pending');
    });
  });

  describe('sortProjectDomainsForDisplay', () => {
    it('sorts active first, then degraded, then pending, then others', () => {
      const domains = [
        { host: 'b.example.com', routeStatus: 'stale', updatedAt: '2023-01-01T00:00:00Z' },
        { host: 'a.example.com', routeStatus: 'active', updatedAt: '2023-01-01T00:00:00Z' },
        { host: 'c.example.com', routeStatus: 'degraded', updatedAt: '2023-01-01T00:00:00Z' },
        { host: 'd.example.com', routeStatus: 'pending', updatedAt: '2023-01-01T00:00:00Z' },
      ] as ApiProjectDomain[];

      const sorted = sortProjectDomainsForDisplay(domains);

      expect(sorted.map((d) => d.host)).toEqual([
        'a.example.com', // active (priority 0)
        'c.example.com', // degraded (priority 1)
        'd.example.com', // pending (priority 2)
        'b.example.com', // stale (priority 3)
      ]);
    });

    it('sorts by updatedAt descending if statuses are equal', () => {
      const domains = [
        { host: 'b.example.com', routeStatus: 'active', updatedAt: '2023-01-01T00:00:00Z' },
        { host: 'a.example.com', routeStatus: 'active', updatedAt: '2023-01-02T00:00:00Z' }, // newer
      ] as ApiProjectDomain[];

      const sorted = sortProjectDomainsForDisplay(domains);

      expect(sorted[0]!.host).toBe('a.example.com'); // newer comes first
    });

    it('sorts alphabetically by host if statuses and dates are equal', () => {
      const domains = [
        { host: 'z.example.com', routeStatus: 'active', updatedAt: '2023-01-01T00:00:00Z' },
        { host: 'a.example.com', routeStatus: 'active', updatedAt: '2023-01-01T00:00:00Z' },
      ] as ApiProjectDomain[];

      const sorted = sortProjectDomainsForDisplay(domains);

      expect(sorted[0]!.host).toBe('a.example.com');
    });
  });

  describe('projectDomainClaimVariant', () => {
    it('identifies healthy states', () => {
      expect(projectDomainClaimVariant('healthy')).toBe('success');
      expect(projectDomainClaimVariant('managed')).toBe('success');
    });

    it('identifies destructive action states', () => {
      expect(projectDomainClaimVariant('fix-verification-record')).toBe('destructive');
      expect(projectDomainClaimVariant('fix-dns')).toBe('destructive');
      expect(projectDomainClaimVariant('review-https')).toBe('destructive');
    });

    it('defaults to warning for pending or configuration states', () => {
      expect(projectDomainClaimVariant('publish-verification-record')).toBe('warning');
      expect(projectDomainClaimVariant('configure-dns')).toBe('warning');
      expect(projectDomainClaimVariant('wait-for-https')).toBe('warning');
      expect(projectDomainClaimVariant('refresh-checks')).toBe('warning');
    });
  });
});
