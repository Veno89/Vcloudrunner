import { resolve4, resolve6, resolveCname, resolveTxt } from 'node:dns/promises';
import { checkServerIdentity, connect as tlsConnect } from 'node:tls';

export type ProjectDomainVerificationStatus = 'managed' | 'verified' | 'pending' | 'mismatch' | 'unknown';
export type ProjectDomainOwnershipStatus = 'managed' | 'verified' | 'pending' | 'mismatch' | 'unknown';
export type ProjectDomainTlsStatus = 'ready' | 'pending' | 'invalid' | 'unknown';
export type ProjectDomainRouteStatus = 'active' | 'degraded' | 'stale' | 'pending';
export type ProjectDomainCertificateValidationReason =
  | 'self-signed'
  | 'hostname-mismatch'
  | 'issuer-untrusted'
  | 'expired'
  | 'not-yet-valid'
  | 'validation-failed';

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
  certificateValidFrom: Date | null;
  certificateValidTo: Date | null;
  certificateSubjectName: string | null;
  certificateIssuerName: string | null;
  certificateSubjectAltNames: string[];
  certificateChainSubjects: string[];
  certificateChainEntries: ProjectDomainCertificateChainEntry[];
  certificateRootSubjectName: string | null;
  certificateValidationReason: ProjectDomainCertificateValidationReason | null;
  certificateFingerprintSha256: string | null;
  certificateSerialNumber: string | null;
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

export interface ProjectDomainCertificateChainEntry {
  subjectName: string | null;
  issuerName: string | null;
  fingerprintSha256: string | null;
  serialNumber: string | null;
  isSelfIssued: boolean;
  validFrom?: Date | null;
  validTo?: Date | null;
}

interface ProjectDomainDnsResolver {
  resolveCname(host: string): Promise<string[]>;
  resolve4(host: string): Promise<string[]>;
  resolve6(host: string): Promise<string[]>;
  resolveTxt(host: string): Promise<string[][]>;
}

interface ProjectDomainPresentedCertificate {
  validFrom: Date | null;
  validTo: Date | null;
  subjectName: string | null;
  issuerName: string | null;
  subjectAltNames: string[];
  chainSubjects: string[];
  chainEntries: ProjectDomainCertificateChainEntry[];
  rootSubjectName: string | null;
  validationReason: ProjectDomainCertificateValidationReason | null;
  fingerprintSha256: string | null;
  serialNumber: string | null;
}

interface ProjectDomainDiagnosticsServiceDependencies {
  dnsResolver?: ProjectDomainDnsResolver;
  fetchFn?: typeof fetch;
  tlsInspector?: (host: string) => Promise<ProjectDomainPresentedCertificate>;
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

function parseCertificateDate(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCertificateName(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const commonName = (value as { CN?: unknown }).CN;
  return typeof commonName === 'string' && commonName.trim().length > 0
    ? commonName.trim()
    : null;
}

function parseCertificateSubjectAltNames(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [];
  }

  const names = value
    .split(/,\s*/g)
    .map((entry) => {
      if (entry.startsWith('DNS:')) {
        return entry.slice(4).trim();
      }

      if (entry.startsWith('IP Address:')) {
        return entry.slice('IP Address:'.length).trim();
      }

      return entry.trim();
    })
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(names));
}

function parseCertificateFingerprintSha256(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const normalized = value.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function parseCertificateSerialNumber(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return value.trim().toUpperCase();
}

function extractPresentedCertificateChain(value: unknown) {
  if (!value || typeof value !== 'object') {
    return {
      chainSubjects: [],
      chainEntries: [],
      rootSubjectName: null
    };
  }

  const chainEntries: ProjectDomainCertificateChainEntry[] = [];
  const seenFingerprints = new Set<string>();
  const seenObjects = new Set<object>();
  let current: unknown = value;

  while (current && typeof current === 'object') {
    const currentRecord = current as Record<string, unknown>;
    if (seenObjects.has(currentRecord)) {
      break;
    }

    seenObjects.add(currentRecord);

    const fingerprint = parseCertificateFingerprintSha256(currentRecord.fingerprint256);
    if (fingerprint) {
      if (seenFingerprints.has(fingerprint)) {
        break;
      }

      seenFingerprints.add(fingerprint);
    }

    const subjectName = parseCertificateName(currentRecord.subject);
    const issuerName = parseCertificateName(currentRecord.issuer);
    const serialNumber = parseCertificateSerialNumber(currentRecord.serialNumber);
    const validFrom = parseCertificateDate(currentRecord.valid_from);
    const validTo = parseCertificateDate(currentRecord.valid_to);

    if (subjectName || issuerName || fingerprint || serialNumber || validFrom || validTo) {
      chainEntries.push({
        subjectName,
        issuerName,
        fingerprintSha256: fingerprint,
        serialNumber,
        isSelfIssued: Boolean(subjectName && issuerName && subjectName === issuerName),
        validFrom,
        validTo
      });
    }

    const issuerCertificate = currentRecord.issuerCertificate;
    if (!issuerCertificate || typeof issuerCertificate !== 'object') {
      break;
    }

    if (issuerCertificate === current) {
      break;
    }

    current = issuerCertificate;
  }

  const chainSubjects = chainEntries
    .map((entry) => entry.subjectName)
    .filter((entry): entry is string => Boolean(entry && entry.trim().length > 0));
  const normalizedChainSubjects = Array.from(new Set(chainSubjects.filter((entry) => entry.trim().length > 0)));

  return {
    chainSubjects: normalizedChainSubjects,
    chainEntries,
    rootSubjectName:
      normalizedChainSubjects.length > 0
        ? normalizedChainSubjects[normalizedChainSubjects.length - 1] ?? null
        : null
  };
}

function mapCertificateValidationReason(input: {
  authorizationError: string | null;
  hostnameError: Error | null;
}): ProjectDomainCertificateValidationReason | null {
  if (input.hostnameError) {
    return 'hostname-mismatch';
  }

  switch (input.authorizationError) {
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
      return 'self-signed';
    case 'CERT_HAS_EXPIRED':
      return 'expired';
    case 'CERT_NOT_YET_VALID':
      return 'not-yet-valid';
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
    case 'UNABLE_TO_GET_ISSUER_CERT':
    case 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY':
    case 'CERT_UNTRUSTED':
      return 'issuer-untrusted';
    default:
      return input.authorizationError ? 'validation-failed' : null;
  }
}

function mapCertificateValidationReasonFromError(error: unknown): ProjectDomainCertificateValidationReason | null {
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes('altname') || message.includes('hostname')) {
    return 'hostname-mismatch';
  }

  if (message.includes('self signed')) {
    return 'self-signed';
  }

  if (message.includes('expired')) {
    return 'expired';
  }

  if (message.includes('not yet valid')) {
    return 'not-yet-valid';
  }

  if (
    message.includes('unable to verify')
    || message.includes('unable to get issuer')
    || message.includes('untrusted')
  ) {
    return 'issuer-untrusted';
  }

  return isTlsValidationError(error) ? 'validation-failed' : null;
}

export class ProjectDomainDiagnosticsService implements ProjectDomainDiagnosticsInspector {
  private readonly dnsResolver: ProjectDomainDnsResolver;
  private readonly fetchFn: typeof fetch;
  private readonly tlsInspector: (host: string) => Promise<ProjectDomainPresentedCertificate>;
  private readonly timeoutMs: number;

  constructor(dependencies: ProjectDomainDiagnosticsServiceDependencies = {}) {
    this.dnsResolver = dependencies.dnsResolver ?? defaultDnsResolver;
    this.fetchFn = dependencies.fetchFn ?? fetch;
    this.tlsInspector = dependencies.tlsInspector ?? ((host) => this.inspectPresentedCertificate(host));
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
    const emptyCertificateWindow = {
      certificateValidFrom: null,
      certificateValidTo: null,
      certificateSubjectName: null,
      certificateIssuerName: null,
      certificateSubjectAltNames: [],
      certificateChainSubjects: [],
      certificateChainEntries: [],
      certificateRootSubjectName: null,
      certificateValidationReason: null,
      certificateFingerprintSha256: null,
      certificateSerialNumber: null
    };

    if (input.routeStatus === 'pending') {
      return {
        tlsStatus: 'pending' as const,
        tlsDetail: 'TLS will be checked after this host is attached to a running deployment route.',
        ...emptyCertificateWindow
      };
    }

    if (input.routeStatus === 'stale') {
      return {
        tlsStatus: 'unknown' as const,
        tlsDetail: 'TLS is not checked while this host points at a stale deployment.',
        ...emptyCertificateWindow
      };
    }

    if (input.ownershipStatus === 'pending') {
      return {
        tlsStatus: 'pending' as const,
        tlsDetail: 'TLS issuance waits for routing DNS to point at the platform target.',
        ...emptyCertificateWindow
      };
    }

    if (input.ownershipStatus === 'mismatch') {
      return {
        tlsStatus: 'pending' as const,
        tlsDetail: 'TLS cannot be verified until routing DNS points at the platform target.',
        ...emptyCertificateWindow
      };
    }

    if (input.ownershipStatus === 'unknown') {
      return {
        tlsStatus: 'unknown' as const,
        tlsDetail: 'TLS could not be checked because routing DNS is not verifiable right now.',
        ...emptyCertificateWindow
      };
    }

    try {
      await this.fetchWithTimeout(`https://${input.host}`);
      const certificateWindow = await this.inspectPresentedCertificateSafe(input.host);
      return {
        tlsStatus: 'ready' as const,
        tlsDetail: 'HTTPS is reachable and the current certificate validated successfully.',
        ...certificateWindow
      };
    } catch (error) {
      if (isTlsValidationError(error)) {
        const certificateWindow = await this.inspectPresentedCertificateSafe(input.host);
        return {
          tlsStatus: 'invalid' as const,
          tlsDetail: `HTTPS reached the host, but certificate validation failed (${getErrorMessage(error)}).`,
          ...certificateWindow,
          certificateValidationReason:
            certificateWindow.certificateValidationReason
            ?? mapCertificateValidationReasonFromError(error)
        };
      }

      return {
        tlsStatus: 'pending' as const,
        tlsDetail: 'HTTPS is not reachable yet. Certificate issuance or propagation may still be in progress.',
        ...emptyCertificateWindow
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

  private async inspectPresentedCertificateSafe(host: string) {
    try {
      const certificate = await this.tlsInspector(host);
      return {
        certificateValidFrom: certificate.validFrom,
        certificateValidTo: certificate.validTo,
        certificateSubjectName: certificate.subjectName,
        certificateIssuerName: certificate.issuerName,
        certificateSubjectAltNames: certificate.subjectAltNames,
        certificateChainSubjects: certificate.chainSubjects,
        certificateChainEntries: certificate.chainEntries,
        certificateRootSubjectName: certificate.rootSubjectName,
        certificateValidationReason: certificate.validationReason,
        certificateFingerprintSha256: certificate.fingerprintSha256,
        certificateSerialNumber: certificate.serialNumber
      };
    } catch {
      return {
        certificateValidFrom: null,
        certificateValidTo: null,
        certificateSubjectName: null,
        certificateIssuerName: null,
        certificateSubjectAltNames: [],
        certificateChainSubjects: [],
        certificateChainEntries: [],
        certificateRootSubjectName: null,
        certificateValidationReason: null,
        certificateFingerprintSha256: null,
        certificateSerialNumber: null
      };
    }
  }

  private async inspectPresentedCertificate(host: string): Promise<ProjectDomainPresentedCertificate> {
    return new Promise((resolve, reject) => {
      const socket = tlsConnect({
        host,
        port: 443,
        servername: host,
        rejectUnauthorized: false
      });

      const cleanup = () => {
        socket.removeAllListeners('secureConnect');
        socket.removeAllListeners('error');
        socket.removeAllListeners('timeout');
      };

      socket.setTimeout(this.timeoutMs);

      socket.once('secureConnect', () => {
        cleanup();

        const certificate = socket.getPeerCertificate(true);
        socket.end();

        if (!certificate || Object.keys(certificate).length === 0) {
          resolve({
            validFrom: null,
            validTo: null,
            subjectName: null,
            issuerName: null,
            subjectAltNames: [],
            chainSubjects: [],
            chainEntries: [],
            rootSubjectName: null,
            validationReason: null,
            fingerprintSha256: null,
            serialNumber: null
          });
          return;
        }

        const hostnameError = checkServerIdentity(host, certificate);
        const validationReason = mapCertificateValidationReason({
          authorizationError:
            socket.authorizationError
              ? getErrorMessage(socket.authorizationError)
              : null,
          hostnameError: hostnameError ?? null
        });
        const chain = extractPresentedCertificateChain(certificate);

        resolve({
          validFrom: parseCertificateDate(certificate.valid_from),
          validTo: parseCertificateDate(certificate.valid_to),
          subjectName: parseCertificateName(certificate.subject),
          issuerName: parseCertificateName(certificate.issuer),
          subjectAltNames: parseCertificateSubjectAltNames(certificate.subjectaltname),
          chainSubjects: chain.chainSubjects,
          chainEntries: chain.chainEntries,
          rootSubjectName: chain.rootSubjectName,
          validationReason,
          fingerprintSha256: parseCertificateFingerprintSha256(certificate.fingerprint256),
          serialNumber: parseCertificateSerialNumber(certificate.serialNumber)
        });
      });

      socket.once('timeout', () => {
        cleanup();
        socket.destroy();
        reject(new Error('TLS certificate inspection timed out.'));
      });

      socket.once('error', (error) => {
        cleanup();
        reject(error);
      });
    });
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
