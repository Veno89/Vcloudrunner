import { resolve4, resolve6, resolveCname, resolveTxt } from 'node:dns/promises';

export type ProjectDomainVerificationStatus = 'managed' | 'verified' | 'pending' | 'mismatch' | 'unknown';
export type ProjectDomainOwnershipStatus = 'managed' | 'verified' | 'pending' | 'mismatch' | 'unknown';
export type ProjectDomainTlsStatus = 'ready' | 'pending' | 'invalid' | 'unknown';
export type ProjectDomainRouteStatus = 'active' | 'degraded' | 'stale' | 'pending';

export const PROJECT_DOMAIN_VERIFICATION_RECORD_PREFIX = '_vcloudrunner';

function normalizeHostname(host: string) {
  return host.trim().toLowerCase().replace(/\.+$/g, '');
}

export function createProjectDomainVerificationRecordName(host: string) {
  return `${PROJECT_DOMAIN_VERIFICATION_RECORD_PREFIX}.${normalizeHostname(host)}`;
}

export function createProjectDomainVerificationRecordValue(token: string) {
  return `vcloudrunner-verify=${token}`;
}

export interface ProjectDomainDiagnosticsRecord {
  verificationStatus: ProjectDomainVerificationStatus;
  verificationDetail: string;
  ownershipStatus: ProjectDomainOwnershipStatus;
  ownershipDetail: string;
  tlsStatus: ProjectDomainTlsStatus;
  tlsDetail: string;
}

export interface ProjectDomainDiagnosticsTarget {
  host: string;
  routeStatus: ProjectDomainRouteStatus;
  verificationToken: string | null;
}

export interface ProjectDomainDiagnosticsInspector {
  inspectDomains(input: {
    defaultHost: string;
    domains: readonly ProjectDomainDiagnosticsTarget[];
  }): Promise<ProjectDomainDiagnosticsRecord[]>;
}

interface DomainDnsSnapshot {
  cnames: string[];
  addresses: string[];
  status: 'resolved' | 'not-found' | 'error';
}

interface DomainTxtSnapshot {
  values: string[];
  status: 'resolved' | 'not-found' | 'error';
}

interface ProjectDomainDnsResolver {
  resolveCname(host: string): Promise<string[]>;
  resolve4(host: string): Promise<string[]>;
  resolve6(host: string): Promise<string[]>;
  resolveTxt(host: string): Promise<string[][]>;
}

interface ProjectDomainDiagnosticsServiceDependencies {
  dnsResolver?: ProjectDomainDnsResolver;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_DIAGNOSTICS_TIMEOUT_MS = 4_000;
const defaultDnsResolver: ProjectDomainDnsResolver = {
  resolveCname: async (host) => resolveCname(host),
  resolve4: async (host) => resolve4(host),
  resolve6: async (host) => resolve6(host),
  resolveTxt: async (host) => resolveTxt(host)
};

function isDnsNotFoundCode(code: unknown) {
  return code === 'ENOTFOUND' || code === 'ENODATA' || code === 'ESERVFAIL' || code === 'ENODOMAIN';
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const maybeError = error as { code?: unknown };
  return typeof maybeError.code === 'string' ? maybeError.code : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isTlsValidationError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes('cert_')
    || message.includes('certificate')
    || message.includes('self signed')
    || message.includes('altname')
    || message.includes('tls')
    || message.includes('ssl')
  );
}

export class ProjectDomainDiagnosticsService implements ProjectDomainDiagnosticsInspector {
  private readonly dnsResolver: ProjectDomainDnsResolver;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(dependencies: ProjectDomainDiagnosticsServiceDependencies = {}) {
    this.dnsResolver = dependencies.dnsResolver ?? defaultDnsResolver;
    this.fetchFn = dependencies.fetchFn ?? fetch;
    this.timeoutMs = dependencies.timeoutMs ?? DEFAULT_DIAGNOSTICS_TIMEOUT_MS;
  }

  async inspectDomains(input: {
    defaultHost: string;
    domains: readonly ProjectDomainDiagnosticsTarget[];
  }): Promise<ProjectDomainDiagnosticsRecord[]> {
    const defaultHost = normalizeHostname(input.defaultHost);
    const defaultHostSnapshot = await this.resolveDnsSnapshot(defaultHost);

    return Promise.all(
      input.domains.map((domain) =>
        this.inspectDomain({
          domain,
          defaultHost,
          defaultHostSnapshot
        })
      )
    );
  }

  private async inspectDomain(input: {
    domain: ProjectDomainDiagnosticsTarget;
    defaultHost: string;
    defaultHostSnapshot: DomainDnsSnapshot;
  }): Promise<ProjectDomainDiagnosticsRecord> {
    const host = normalizeHostname(input.domain.host);
    const verification = host === input.defaultHost
      ? {
          verificationStatus: 'managed' as const,
          verificationDetail: 'This is the platform-managed default host for the project.'
        }
      : await this.inspectVerification({
          host,
          verificationToken: input.domain.verificationToken
        });
    const ownership = host === input.defaultHost
      ? {
          ownershipStatus: 'managed' as const,
          ownershipDetail: 'This is the platform-managed default host for the project.'
        }
      : await this.inspectOwnership({
          host,
          defaultHost: input.defaultHost,
          defaultHostSnapshot: input.defaultHostSnapshot
        });
    const tls = await this.inspectTls({
      host,
      routeStatus: input.domain.routeStatus,
      ownershipStatus: ownership.ownershipStatus
    });

    return {
      ...verification,
      ...ownership,
      ...tls
    };
  }

  private async inspectVerification(input: {
    host: string;
    verificationToken: string | null;
  }) {
    if (!input.verificationToken) {
      return {
        verificationStatus: 'unknown' as const,
        verificationDetail:
          'No ownership verification token is currently stored for this custom host. Remove and re-add the host if this persists.'
      };
    }

    const recordName = createProjectDomainVerificationRecordName(input.host);
    const expectedValue = createProjectDomainVerificationRecordValue(input.verificationToken);
    const snapshot = await this.resolveTxtSnapshot(recordName);

    if (snapshot.status === 'not-found') {
      return {
        verificationStatus: 'pending' as const,
        verificationDetail: `Publish the TXT record ${recordName} with value ${expectedValue} to verify ownership.`
      };
    }

    if (snapshot.status === 'error') {
      return {
        verificationStatus: 'unknown' as const,
        verificationDetail: 'The control plane could not read the TXT ownership challenge right now.'
      };
    }

    if (snapshot.values.includes(expectedValue)) {
      return {
        verificationStatus: 'verified' as const,
        verificationDetail: `Ownership challenge verified through TXT record ${recordName}.`
      };
    }

    return {
      verificationStatus: 'mismatch' as const,
      verificationDetail: `TXT records were found at ${recordName}, but they do not include the expected verification value ${expectedValue}.`
    };
  }

  private async inspectOwnership(input: {
    host: string;
    defaultHost: string;
    defaultHostSnapshot: DomainDnsSnapshot;
  }) {
    const snapshot = await this.resolveDnsSnapshot(input.host);

    if (snapshot.status === 'not-found') {
      return {
        ownershipStatus: 'pending' as const,
        ownershipDetail: `No public DNS records were found yet. Point this host at ${input.defaultHost} to verify ownership.`
      };
    }

    if (snapshot.status === 'error') {
      return {
        ownershipStatus: 'unknown' as const,
        ownershipDetail: 'DNS ownership could not be checked from the control plane right now.'
      };
    }

    if (input.defaultHostSnapshot.status !== 'resolved') {
      return {
        ownershipStatus: 'unknown' as const,
        ownershipDetail: `The platform default host ${input.defaultHost} is not publicly resolvable from the control plane, so custom DNS cannot be compared automatically right now.`
      };
    }

    const normalizedCnames = snapshot.cnames.map(normalizeHostname);
    if (normalizedCnames.includes(input.defaultHost)) {
      return {
        ownershipStatus: 'verified' as const,
        ownershipDetail: `Routing DNS verified. This host resolves to the platform target ${input.defaultHost}.`
      };
    }

    const defaultAddresses = new Set(input.defaultHostSnapshot.addresses);
    const sharesAddress = snapshot.addresses.some((address) => defaultAddresses.has(address));

    if (sharesAddress) {
      return {
        ownershipStatus: 'verified' as const,
        ownershipDetail: `Routing DNS verified. This host resolves to the same network target as ${input.defaultHost}.`
      };
    }

    return {
      ownershipStatus: 'mismatch' as const,
      ownershipDetail: `Routing DNS resolves away from the platform target. Point this host at ${input.defaultHost} to verify routing.`
    };
  }

  private async inspectTls(input: {
    host: string;
    routeStatus: ProjectDomainRouteStatus;
    ownershipStatus: ProjectDomainOwnershipStatus;
  }) {
    if (input.routeStatus === 'pending') {
      return {
        tlsStatus: 'pending' as const,
        tlsDetail: 'TLS will be checked after this host is attached to a running deployment route.'
      };
    }

    if (input.routeStatus === 'stale') {
      return {
        tlsStatus: 'unknown' as const,
        tlsDetail: 'TLS is not checked while this host points at a stale deployment.'
      };
    }

    if (input.ownershipStatus === 'pending') {
      return {
        tlsStatus: 'pending' as const,
        tlsDetail: 'TLS issuance waits for routing DNS to point at the platform target.'
      };
    }

    if (input.ownershipStatus === 'mismatch') {
      return {
        tlsStatus: 'pending' as const,
        tlsDetail: 'TLS cannot be verified until routing DNS points at the platform target.'
      };
    }

    if (input.ownershipStatus === 'unknown') {
      return {
        tlsStatus: 'unknown' as const,
        tlsDetail: 'TLS could not be checked because routing DNS is not verifiable right now.'
      };
    }

    try {
      await this.fetchWithTimeout(`https://${input.host}`);
      return {
        tlsStatus: 'ready' as const,
        tlsDetail: 'HTTPS is reachable and the current certificate validated successfully.'
      };
    } catch (error) {
      if (isTlsValidationError(error)) {
        return {
          tlsStatus: 'invalid' as const,
          tlsDetail: `HTTPS reached the host, but certificate validation failed (${getErrorMessage(error)}).`
        };
      }

      return {
        tlsStatus: 'pending' as const,
        tlsDetail: 'HTTPS is not reachable yet. Certificate issuance or propagation may still be in progress.'
      };
    }
  }

  private async fetchWithTimeout(url: string) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      await this.fetchFn(url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async resolveDnsSnapshot(host: string): Promise<DomainDnsSnapshot> {
    const [cnames, ipv4, ipv6] = await Promise.allSettled([
      this.dnsResolver.resolveCname(host),
      this.dnsResolver.resolve4(host),
      this.dnsResolver.resolve6(host)
    ]);

    const collectedCnames = cnames.status === 'fulfilled'
      ? cnames.value.map(normalizeHostname)
      : [];
    const collectedAddresses = [
      ...(ipv4.status === 'fulfilled' ? ipv4.value : []),
      ...(ipv6.status === 'fulfilled' ? ipv6.value : [])
    ];

    if (collectedCnames.length > 0 || collectedAddresses.length > 0) {
      return {
        cnames: collectedCnames,
        addresses: collectedAddresses,
        status: 'resolved'
      };
    }

    const failures = [cnames, ipv4, ipv6]
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => getErrorCode(result.reason));

    if (failures.length > 0 && failures.every((code) => isDnsNotFoundCode(code))) {
      return {
        cnames: [],
        addresses: [],
        status: 'not-found'
      };
    }

    return {
      cnames: [],
      addresses: [],
      status: 'error'
    };
  }

  private async resolveTxtSnapshot(host: string): Promise<DomainTxtSnapshot> {
    try {
      const records = await this.dnsResolver.resolveTxt(host);

      return {
        values: records.flat().map((value) => value.trim()).filter((value) => value.length > 0),
        status: 'resolved'
      };
    } catch (error) {
      if (isDnsNotFoundCode(getErrorCode(error))) {
        return {
          values: [],
          status: 'not-found'
        };
      }

      return {
        values: [],
        status: 'error'
      };
    }
  }
}

export const defaultProjectDomainDiagnosticsService = new ProjectDomainDiagnosticsService();
