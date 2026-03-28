import assert from 'node:assert/strict';
import test from 'node:test';

const {
  ProjectDomainDiagnosticsService
} = await import('./project-domain-diagnostics.service.js');

function createResolver(overrides: Partial<{
  resolveCname: (host: string) => Promise<string[]>;
  resolve4: (host: string) => Promise<string[]>;
  resolve6: (host: string) => Promise<string[]>;
  resolveTxt: (host: string) => Promise<string[][]>;
}> = {}) {
  return {
    resolveCname: overrides.resolveCname ?? (async () => []),
    resolve4: overrides.resolve4 ?? (async () => []),
    resolve6: overrides.resolve6 ?? (async () => []),
    resolveTxt: overrides.resolveTxt ?? (async () => [])
  };
}

test('inspectDomains marks custom domains verified when the TXT ownership challenge matches', async () => {
  const service = new ProjectDomainDiagnosticsService({
    dnsResolver: createResolver({
      resolveCname: async (host) => {
        if (host === 'custom.example.com') {
          return ['example-project.platform.local'];
        }

        return [];
      },
      resolve4: async (host) => {
        if (host === 'example-project.platform.local') {
          return ['203.0.113.10'];
        }

        return [];
      },
      resolveTxt: async (host) => {
        if (host === '_vcloudrunner.custom.example.com') {
          return [['vcloudrunner-verify=challenge-token']];
        }

        return [];
      }
    }),
    fetchFn: async () => new Response(null, { status: 200 })
  });

  const [record] = await service.inspectDomains({
    defaultHost: 'example-project.platform.local',
    domains: [{
      host: 'custom.example.com',
      routeStatus: 'pending',
      verificationToken: 'challenge-token'
    }]
  });

  assert.equal(record?.verificationStatus, 'verified');
  assert.match(record?.verificationDetail ?? '', /Ownership challenge verified/i);
  assert.equal(record?.ownershipStatus, 'verified');
  assert.match(record?.ownershipDetail ?? '', /resolves to the platform target/i);
  assert.equal(record?.tlsStatus, 'pending');
});

test('inspectDomains marks missing TXT ownership challenges as pending verification', async () => {
  const service = new ProjectDomainDiagnosticsService({
    dnsResolver: createResolver({
      resolveTxt: async () => {
        const error = new Error('not found') as Error & { code?: string };
        error.code = 'ENOTFOUND';
        throw error;
      },
      resolveCname: async () => {
        const error = new Error('not found') as Error & { code?: string };
        error.code = 'ENOTFOUND';
        throw error;
      },
      resolve4: async (host) => {
        if (host === 'example-project.platform.local') {
          return ['203.0.113.10'];
        }

        const error = new Error('not found') as Error & { code?: string };
        error.code = 'ENOTFOUND';
        throw error;
      },
      resolve6: async () => {
        const error = new Error('not found') as Error & { code?: string };
        error.code = 'ENOTFOUND';
        throw error;
      }
    }),
    fetchFn: async () => new Response(null, { status: 200 })
  });

  const [record] = await service.inspectDomains({
    defaultHost: 'example-project.platform.local',
    domains: [{
      host: 'custom.example.com',
      routeStatus: 'pending',
      verificationToken: 'challenge-token'
    }]
  });

  assert.equal(record?.verificationStatus, 'pending');
  assert.match(record?.verificationDetail ?? '', /Publish the TXT record/i);
  assert.equal(record?.ownershipStatus, 'pending');
  assert.match(record?.ownershipDetail ?? '', /No public DNS records were found yet/i);
  assert.equal(record?.tlsStatus, 'pending');
});

test('inspectDomains marks incorrect TXT ownership challenges as mismatch', async () => {
  const service = new ProjectDomainDiagnosticsService({
    dnsResolver: createResolver({
      resolveTxt: async (host) => {
        if (host === '_vcloudrunner.custom.example.com') {
          return [['vcloudrunner-verify=wrong-token']];
        }

        return [];
      },
      resolve4: async () => ['203.0.113.10']
    }),
    fetchFn: async () => new Response(null, { status: 200 })
  });

  const [record] = await service.inspectDomains({
    defaultHost: 'example-project.platform.local',
    domains: [{
      host: 'custom.example.com',
      routeStatus: 'active',
      verificationToken: 'challenge-token'
    }]
  });

  assert.equal(record?.verificationStatus, 'mismatch');
  assert.match(record?.verificationDetail ?? '', /do not include the expected verification value/i);
});

test('inspectDomains marks custom DNS mismatch when addresses diverge from the platform target', async () => {
  const service = new ProjectDomainDiagnosticsService({
    dnsResolver: createResolver({
      resolveTxt: async () => {
        const error = new Error('not found') as Error & { code?: string };
        error.code = 'ENOTFOUND';
        throw error;
      },
      resolve4: async (host) => {
        if (host === 'example-project.platform.local') {
          return ['203.0.113.10'];
        }

        if (host === 'custom.example.com') {
          return ['198.51.100.77'];
        }

        return [];
      }
    }),
    fetchFn: async () => new Response(null, { status: 200 })
  });

  const [record] = await service.inspectDomains({
    defaultHost: 'example-project.platform.local',
    domains: [{
      host: 'custom.example.com',
      routeStatus: 'active',
      verificationToken: 'challenge-token'
    }]
  });

  assert.equal(record?.verificationStatus, 'pending');
  assert.equal(record?.ownershipStatus, 'mismatch');
  assert.match(record?.ownershipDetail ?? '', /resolves away from the platform target/i);
  assert.equal(record?.tlsStatus, 'pending');
});

test('inspectDomains marks the managed default host ready when HTTPS is reachable', async () => {
  const fetchCalls: Array<{ url: string; method?: string }> = [];
  const service = new ProjectDomainDiagnosticsService({
    dnsResolver: createResolver({
      resolve4: async () => ['203.0.113.10']
    }),
    fetchFn: async (input, init) => {
      fetchCalls.push({ url: String(input), method: init?.method });
      return new Response(null, { status: 404 });
    }
  });

  const [record] = await service.inspectDomains({
    defaultHost: 'example-project.platform.local',
    domains: [{
      host: 'example-project.platform.local',
      routeStatus: 'active',
      verificationToken: null
    }]
  });

  assert.equal(record?.verificationStatus, 'managed');
  assert.equal(record?.ownershipStatus, 'managed');
  assert.equal(record?.tlsStatus, 'ready');
  assert.deepEqual(fetchCalls, [{
    url: 'https://example-project.platform.local',
    method: 'HEAD'
  }]);
});

test('inspectDomains marks TLS invalid when HTTPS fails certificate validation', async () => {
  const service = new ProjectDomainDiagnosticsService({
    dnsResolver: createResolver({
      resolveCname: async (host) => {
        if (host === 'custom.example.com') {
          return ['example-project.platform.local'];
        }

        return [];
      },
      resolve4: async () => ['203.0.113.10'],
      resolveTxt: async (host) => {
        if (host === '_vcloudrunner.custom.example.com') {
          return [['vcloudrunner-verify=challenge-token']];
        }

        return [];
      }
    }),
    fetchFn: async () => {
      throw new Error('CERT_HAS_EXPIRED');
    }
  });

  const [record] = await service.inspectDomains({
    defaultHost: 'example-project.platform.local',
    domains: [{
      host: 'custom.example.com',
      routeStatus: 'active',
      verificationToken: 'challenge-token'
    }]
  });

  assert.equal(record?.verificationStatus, 'verified');
  assert.equal(record?.ownershipStatus, 'verified');
  assert.equal(record?.tlsStatus, 'invalid');
  assert.match(record?.tlsDetail ?? '', /certificate validation failed/i);
});
