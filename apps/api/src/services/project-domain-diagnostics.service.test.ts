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

function createTlsInspector(overrides: Partial<{
  validFrom: Date | null;
  validTo: Date | null;
  subjectName: string | null;
  issuerName: string | null;
  subjectAltNames: string[];
  chainSubjects: string[];
  chainEntries: Array<{
    subjectName: string | null;
    issuerName: string | null;
    fingerprintSha256: string | null;
    serialNumber: string | null;
    isSelfIssued: boolean;
    validFrom?: Date | null;
    validTo?: Date | null;
  }>;
  rootSubjectName: string | null;
  fingerprintSha256: string | null;
  serialNumber: string | null;
  validationReason:
    | 'self-signed'
    | 'hostname-mismatch'
    | 'issuer-untrusted'
    | 'expired'
    | 'not-yet-valid'
    | 'validation-failed'
    | null;
}> = {}) {
  return async () => ({
    validFrom: overrides.validFrom ?? null,
    validTo: overrides.validTo ?? null,
    subjectName: overrides.subjectName ?? null,
    issuerName: overrides.issuerName ?? null,
    subjectAltNames: overrides.subjectAltNames ?? [],
    chainSubjects: overrides.chainSubjects ?? [],
    chainEntries: overrides.chainEntries ?? (
      overrides.chainSubjects ?? []
    ).map((subjectName) => ({
      subjectName,
      issuerName: overrides.issuerName ?? null,
      fingerprintSha256: overrides.fingerprintSha256 ?? null,
      serialNumber: overrides.serialNumber ?? null,
      isSelfIssued: Boolean(
        subjectName
        && overrides.issuerName
        && subjectName === overrides.issuerName
      ),
      validFrom: overrides.validFrom ?? null,
      validTo: overrides.validTo ?? null
    })),
    rootSubjectName: overrides.rootSubjectName ?? null,
    fingerprintSha256: overrides.fingerprintSha256 ?? null,
    serialNumber: overrides.serialNumber ?? null,
    validationReason: overrides.validationReason ?? null
  });
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
    fetchFn: async () => new Response(null, { status: 200 }),
    tlsInspector: createTlsInspector({
      validFrom: new Date('2026-03-01T00:00:00.000Z'),
      validTo: new Date('2026-06-01T00:00:00.000Z')
    })
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
  assert.equal(record?.certificateValidTo, null);
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
    fetchFn: async () => new Response(null, { status: 200 }),
    tlsInspector: createTlsInspector({
      validFrom: new Date('2026-03-01T00:00:00.000Z'),
      validTo: new Date('2026-06-01T00:00:00.000Z')
    })
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
  assert.equal(record?.certificateValidTo?.toISOString(), '2026-06-01T00:00:00.000Z');
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
    },
    tlsInspector: createTlsInspector({
      validFrom: new Date('2026-03-01T00:00:00.000Z'),
      validTo: new Date('2026-06-01T00:00:00.000Z'),
      subjectName: 'example-project.platform.local',
      issuerName: 'Example Issuer',
      subjectAltNames: ['example-project.platform.local', 'www.example-project.platform.local'],
      chainSubjects: ['example-project.platform.local', 'Example Issuer Root'],
      rootSubjectName: 'Example Issuer Root',
      fingerprintSha256: 'aa11bb22cc33dd44ee55ff6677889900aa11bb22cc33dd44ee55ff6677889900',
      serialNumber: '00A1B2C3'
    })
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
  assert.equal(record?.certificateValidFrom?.toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(record?.certificateValidTo?.toISOString(), '2026-06-01T00:00:00.000Z');
  assert.equal(record?.certificateSubjectName, 'example-project.platform.local');
  assert.equal(record?.certificateIssuerName, 'Example Issuer');
  assert.deepEqual(record?.certificateSubjectAltNames, [
    'example-project.platform.local',
    'www.example-project.platform.local'
  ]);
  assert.deepEqual(record?.certificateChainSubjects, [
    'example-project.platform.local',
    'Example Issuer Root'
  ]);
  assert.equal(record?.certificateChainEntries[0]?.validFrom?.toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(record?.certificateChainEntries[0]?.validTo?.toISOString(), '2026-06-01T00:00:00.000Z');
  assert.equal(record?.certificateRootSubjectName, 'Example Issuer Root');
  assert.equal(record?.certificateValidationReason, null);
  assert.equal(
    record?.certificateFingerprintSha256,
    'aa11bb22cc33dd44ee55ff6677889900aa11bb22cc33dd44ee55ff6677889900'
  );
  assert.equal(record?.certificateSerialNumber, '00A1B2C3');
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
    },
    tlsInspector: createTlsInspector({
      validFrom: new Date('2025-12-01T00:00:00.000Z'),
      validTo: new Date('2026-02-01T00:00:00.000Z'),
      subjectName: 'custom.example.com',
      issuerName: 'Example Issuer',
      subjectAltNames: ['custom.example.com'],
      chainSubjects: ['custom.example.com'],
      rootSubjectName: 'custom.example.com',
      fingerprintSha256: 'bb22cc33dd44ee55ff6677889900aa11bb22cc33dd44ee55ff6677889900aa11',
      serialNumber: '0099AABB',
      validationReason: 'expired'
    })
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
  assert.equal(record?.certificateValidTo?.toISOString(), '2026-02-01T00:00:00.000Z');
  assert.equal(record?.certificateValidationReason, 'expired');
  assert.equal(record?.certificateIssuerName, 'Example Issuer');
  assert.deepEqual(record?.certificateSubjectAltNames, ['custom.example.com']);
  assert.deepEqual(record?.certificateChainSubjects, ['custom.example.com']);
  assert.equal(record?.certificateRootSubjectName, 'custom.example.com');
  assert.equal(
    record?.certificateFingerprintSha256,
    'bb22cc33dd44ee55ff6677889900aa11bb22cc33dd44ee55ff6677889900aa11'
  );
  assert.equal(record?.certificateSerialNumber, '0099AABB');
});

test('inspectDomains records hostname-mismatch certificate metadata when HTTPS serves the wrong certificate', async () => {
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
      throw new Error('ERR_TLS_CERT_ALTNAME_INVALID');
    },
    tlsInspector: createTlsInspector({
      validFrom: new Date('2026-03-01T00:00:00.000Z'),
      validTo: new Date('2026-06-01T00:00:00.000Z'),
      subjectName: 'platform.example.com',
      issuerName: 'Example Issuer',
      subjectAltNames: ['platform.example.com'],
      validationReason: 'hostname-mismatch'
    })
  });

  const [record] = await service.inspectDomains({
    defaultHost: 'example-project.platform.local',
    domains: [{
      host: 'custom.example.com',
      routeStatus: 'active',
      verificationToken: 'challenge-token'
    }]
  });

  assert.equal(record?.tlsStatus, 'invalid');
  assert.equal(record?.certificateValidationReason, 'hostname-mismatch');
  assert.equal(record?.certificateSubjectName, 'platform.example.com');
  assert.deepEqual(record?.certificateSubjectAltNames, ['platform.example.com']);
});
