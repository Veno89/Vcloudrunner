import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPrimaryProjectService } from '@vcloudrunner/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionToast } from '@/components/action-toast';
import { DashboardUnavailableState } from '@/components/dashboard-unavailable-state';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { DeploymentStatusBadges } from '@/components/deployment-status-badges';
import { EmptyState } from '@/components/empty-state';
import { FormSubmitButton } from '@/components/form-submit-button';
import { PageLayout } from '@/components/page-layout';
import { ProjectSubnav } from '@/components/project-subnav';
import {
  apiAuthToken,
  fetchProjectDomains,
  fetchProjectMembers,
  fetchProjectsForCurrentUser,
  type ApiProjectDomain,
  resolveViewerContext
} from '@/lib/api';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import {
  createProjectDomainAction,
  refreshProjectDomainDiagnosticsAction,
  removeProjectDomainAction,
  verifyProjectDomainClaimAction
} from '@/app/projects/actions';
import {
  createExpectedProjectDomainHost,
  formatProjectDomainEventKindLabel,
  formatProjectDomainClaimLabel,
  formatProjectDomainEventStatusTransition,
  formatProjectDomainDiagnosticsFreshnessLabel,
  formatProjectDomainVerificationLabel,
  formatProjectDomainOwnershipLabel,
  formatProjectDomainTlsLabel,
  formatProjectRouteStatusLabel,
  hasProjectDomainOwnershipDrift,
  hasProjectDomainTlsRegression,
  projectDomainClaimVariant,
  projectDomainDiagnosticsFreshnessVariant,
  projectDomainVerificationStatusVariant,
  projectDomainOwnershipStatusVariant,
  projectDomainTlsStatusVariant,
  projectRouteStatusVariant,
  sortProjectDomainsForDisplay,
  summarizeProjectDomains
} from '@/lib/project-domains';
import { describeDashboardLiveDataFailure, formatRelativeTime, truncateUuid } from '@/lib/helpers';

interface ProjectDomainsPageProps {
  params: {
    id: string;
  };
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
  };
}

function describeVerificationTimeline(domain: ApiProjectDomain): string | null {
  const changedAt = domain.verificationStatusChangedAt ?? domain.verificationCheckedAt;
  if (!changedAt || !domain.verificationStatus) {
    return null;
  }

  if (domain.verificationStatus === 'managed' || domain.verificationStatus === 'verified') {
    return `Current claim-verification state since ${formatRelativeTime(changedAt)}.`;
  }

  if (domain.verificationStatus === 'mismatch') {
    return `Ownership TXT mismatch first recorded ${formatRelativeTime(changedAt)}.`;
  }

  if (domain.verificationStatus === 'pending') {
    return `Ownership TXT challenge still pending as of ${formatRelativeTime(changedAt)}.`;
  }

  return `Ownership TXT verification has been unavailable since ${formatRelativeTime(changedAt)}.`;
}

function describeOwnershipTimeline(domain: ApiProjectDomain): string | null {
  const changedAt = domain.ownershipStatusChangedAt ?? domain.diagnosticsCheckedAt;
  if (!changedAt || !domain.ownershipStatus) {
    return null;
  }

  if (domain.ownershipStatus === 'managed' || domain.ownershipStatus === 'verified') {
    return `Current DNS state since ${formatRelativeTime(changedAt)}.`;
  }

  if (hasProjectDomainOwnershipDrift(domain) && domain.ownershipVerifiedAt) {
    if (domain.ownershipStatus === 'mismatch') {
      return `DNS drift detected ${formatRelativeTime(changedAt)} after last confirmation ${formatRelativeTime(domain.ownershipVerifiedAt)}.`;
    }

    if (domain.ownershipStatus === 'pending') {
      return `DNS stopped pointing at the platform target ${formatRelativeTime(changedAt)} after last confirmation ${formatRelativeTime(domain.ownershipVerifiedAt)}.`;
    }

    return `Automatic DNS verification has been uncertain since ${formatRelativeTime(changedAt)}; last confirmation was ${formatRelativeTime(domain.ownershipVerifiedAt)}.`;
  }

  if (domain.ownershipStatus === 'mismatch') {
    return `DNS mismatch first recorded ${formatRelativeTime(changedAt)}.`;
  }

  if (domain.ownershipStatus === 'pending') {
    return `DNS pending since ${formatRelativeTime(changedAt)}.`;
  }

  return `Automatic DNS verification has been unavailable since ${formatRelativeTime(changedAt)}.`;
}

function describeTlsTimeline(domain: ApiProjectDomain): string | null {
  const changedAt = domain.tlsStatusChangedAt ?? domain.diagnosticsCheckedAt;
  if (!changedAt || !domain.tlsStatus) {
    return null;
  }

  if (domain.tlsStatus === 'ready') {
    return `Current HTTPS state since ${formatRelativeTime(changedAt)}.`;
  }

  if (hasProjectDomainTlsRegression(domain) && domain.tlsReadyAt) {
    if (domain.tlsStatus === 'invalid') {
      return `Certificate validation started failing ${formatRelativeTime(changedAt)} after last healthy HTTPS ${formatRelativeTime(domain.tlsReadyAt)}.`;
    }

    if (domain.tlsStatus === 'pending') {
      return `HTTPS stopped looking healthy ${formatRelativeTime(changedAt)} after last healthy HTTPS ${formatRelativeTime(domain.tlsReadyAt)}.`;
    }

    return `HTTPS could not be revalidated ${formatRelativeTime(changedAt)}; last healthy HTTPS was ${formatRelativeTime(domain.tlsReadyAt)}.`;
  }

  if (domain.tlsStatus === 'invalid') {
    return `Certificate validation failures were first recorded ${formatRelativeTime(changedAt)}.`;
  }

  if (domain.tlsStatus === 'pending') {
    return `HTTPS is still pending as of ${formatRelativeTime(changedAt)}.`;
  }

  return `HTTPS status has been unavailable since ${formatRelativeTime(changedAt)}.`;
}

export default async function ProjectDomainsPage({ params, searchParams }: ProjectDomainsPageProps) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();

  if (!viewer) {
    return (
      <PageLayout>
        <DashboardUnavailableState
          requestAuth={requestAuth}
          {...(viewerContextError ? { error: viewerContextError } : {})}
          redirectTo={`/projects/${params.id}/domains`}
        />
      </PageLayout>
    );
  }

  try {
    const projects = await fetchProjectsForCurrentUser();
    const project = projects.find((item) => item.id === params.id);

    if (!project) {
      notFound();
    }

    const primaryService = getPrimaryProjectService(project.services);
    const expectedHost = createExpectedProjectDomainHost(project);

    let domains: Awaited<ReturnType<typeof fetchProjectDomains>> = [];
    let domainReadErrorMessage: string | null = null;
    let projectMembers: Awaited<ReturnType<typeof fetchProjectMembers>> = [];
    let projectMembersReadErrorMessage: string | null = null;

    try {
      domains = await fetchProjectDomains(project.id);
    } catch (error) {
      domainReadErrorMessage = describeDashboardLiveDataFailure({
        error,
        hasDemoUserId: Boolean(viewer.userId),
        hasApiAuthToken: Boolean(apiAuthToken)
      });
    }

    try {
      projectMembers = await fetchProjectMembers(project.id);
    } catch (error) {
      projectMembersReadErrorMessage = describeDashboardLiveDataFailure({
        error,
        hasDemoUserId: Boolean(viewer.userId),
        hasApiAuthToken: Boolean(apiAuthToken)
      });
    }

    const sortedDomains = sortProjectDomainsForDisplay(domains);
    const staleDiagnosticsCount = sortedDomains.filter(
      (domain) => domain.diagnosticsFreshnessStatus === 'stale'
    ).length;
    const uncheckedDiagnosticsCount = sortedDomains.filter(
      (domain) => domain.diagnosticsFreshnessStatus === 'unchecked'
    ).length;
    const ownershipDriftCount = sortedDomains.filter(hasProjectDomainOwnershipDrift).length;
    const tlsRegressionCount = sortedDomains.filter(hasProjectDomainTlsRegression).length;
    const routeSummary = summarizeProjectDomains({
      project,
      domains: sortedDomains,
      domainsUnavailable: Boolean(domainReadErrorMessage)
    });
    const currentViewerMembership = projectMembers.find((member) => member.userId === viewer.userId) ?? null;
    const canManageDomains =
      Boolean(viewer.user)
      && (
        viewer.role === 'admin'
        || project.userId === viewer.userId
        || currentViewerMembership?.role === 'admin'
      );

    return (
      <PageLayout>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          <Link href={`/projects/${project.id}`} className="hover:text-foreground">{project.name}</Link>
          <span>/</span>
          <span className="text-foreground">Domains</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Project Domains</h1>
              <p className="text-sm text-muted-foreground">
                Published hosts and routing health for <span className="font-medium text-foreground">{project.name}</span>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={routeSummary.variant}>{routeSummary.label}</Badge>
              <span className="font-mono text-sm text-primary">{routeSummary.host}</span>
              <Badge variant={primaryService.exposure === 'public' ? 'default' : 'secondary'}>
                public service: {primaryService.name}
              </Badge>
            </div>
          </div>
          <form action={refreshProjectDomainDiagnosticsAction} className="flex items-center gap-2">
            <input type="hidden" name="projectId" value={project.id} readOnly />
            <input type="hidden" name="returnPath" value={`/projects/${project.id}/domains`} readOnly />
            <FormSubmitButton
              idleText="Refresh Checks"
              pendingText="Refreshing..."
              variant="outline"
            />
          </form>
        </div>

        <ProjectSubnav projectId={project.id} />

        {domainReadErrorMessage ? (
          <DemoModeBanner title="Partial outage" detail={domainReadErrorMessage}>
            Domain and routing status is temporarily unavailable.
          </DemoModeBanner>
        ) : null}

        {projectMembersReadErrorMessage ? (
          <DemoModeBanner title="Permission visibility degraded" detail={projectMembersReadErrorMessage}>
            Domain records are still visible, but domain-management controls may be limited until project membership data reloads.
          </DemoModeBanner>
        ) : null}

        <ActionToast
          status={searchParams?.status}
          message={searchParams?.message}
          fallbackErrorMessage="Project domain operation failed."
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Route Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{routeSummary.detail}</p>
            <p className="text-xs text-muted-foreground">
              Expected default host: <span className="font-mono text-foreground">{expectedHost}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Public routes are currently tied to the project&apos;s public web service and become visible here after successful deploys.
            </p>
            <p className="text-xs text-muted-foreground">
              Stored claim-verification, DNS, and TLS checks below refresh automatically in the background and can also be refreshed on demand. Active custom domains can be detached here immediately, while newly claimed hosts still become live on the next successful deployment of the public service.
            </p>
            {staleDiagnosticsCount > 0 || uncheckedDiagnosticsCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Diagnostics attention:
                {' '}
                {staleDiagnosticsCount > 0 ? `${staleDiagnosticsCount} stale` : '0 stale'}
                {uncheckedDiagnosticsCount > 0
                  ? `, ${uncheckedDiagnosticsCount} not yet recorded`
                  : ', 0 not yet recorded'}
                .
              </p>
            ) : null}
            {ownershipDriftCount > 0 || tlsRegressionCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Drift attention:
                {' '}
                {ownershipDriftCount > 0 ? `${ownershipDriftCount} DNS drifted` : '0 DNS drifted'}
                {tlsRegressionCount > 0
                  ? `, ${tlsRegressionCount} HTTPS regressions since last healthy`
                  : ', 0 HTTPS regressions since last healthy'}
                .
              </p>
            ) : null}
          </CardContent>
        </Card>

        {canManageDomains ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add Custom Domain</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <form action={createProjectDomainAction} className="grid gap-2 md:grid-cols-[1fr_auto]">
                <input type="hidden" name="projectId" value={project.id} readOnly />
                <input type="hidden" name="returnPath" value={`/projects/${project.id}/domains`} readOnly />
                <div className="space-y-2">
                  <Label htmlFor="project-domain-host" className="sr-only">Custom domain host</Label>
                  <Input
                    id="project-domain-host"
                    name="host"
                    type="text"
                    required
                    placeholder="api.example.com"
                    className="font-mono"
                  />
                </div>
                <FormSubmitButton
                  idleText="Add Domain"
                  pendingText="Saving..."
                  className="md:self-end"
                />
              </form>
              <p className="text-xs text-muted-foreground">
                Use an external hostname like <span className="font-mono text-foreground">api.example.com</span>. Platform-managed hosts under <span className="font-mono text-foreground">{expectedHost}</span> stay reserved and do not need to be added here.
              </p>
              <p className="text-xs text-muted-foreground">
                New custom hosts start with a TXT ownership challenge. Once the claim verifies and routing DNS is pointed at the platform target, the host still becomes live on the next successful deployment of the public service.
              </p>
            </CardContent>
          </Card>
        ) : viewer.user ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add Custom Domain</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Domain management currently requires owner, admin, or project-admin access.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {domainReadErrorMessage ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Published Routes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
                <p className="font-medium text-destructive">Project domains unavailable</p>
                <p className="mt-1 text-xs">{domainReadErrorMessage}</p>
              </div>
            </CardContent>
          </Card>
        ) : sortedDomains.length === 0 ? (
          <EmptyState
            title="No published routes yet"
            description={`Deploy the public service "${primaryService.name}" successfully to publish ${expectedHost}.`}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Published Routes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sortedDomains.map((domain) => {
                const isCustomHost = domain.host !== expectedHost;
                const hasInFlightRouteAttachment =
                  domain.deploymentStatus === 'queued'
                  || domain.deploymentStatus === 'building';
                const canRemoveDomain = canManageDomains && isCustomHost && !hasInFlightRouteAttachment;

                return (
                  <div
                    key={domain.id}
                    className="rounded-md border px-3 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm text-primary">{domain.host}</p>
                          <Badge variant={projectRouteStatusVariant(domain.routeStatus)}>
                            {formatProjectRouteStatusLabel(domain.routeStatus)}
                          </Badge>
                          {domain.serviceName ? (
                            <Badge variant="outline">{domain.serviceName}</Badge>
                          ) : null}
                          {domain.serviceKind ? (
                            <Badge variant="secondary">{domain.serviceKind}</Badge>
                          ) : null}
                          {domain.serviceExposure ? (
                            <Badge variant={domain.serviceExposure === 'public' ? 'default' : 'secondary'}>
                              {domain.serviceExposure}
                            </Badge>
                          ) : null}
                          <Badge variant="outline">
                            {isCustomHost ? 'custom host' : 'default host'}
                          </Badge>
                          {domain.deploymentStatus ? (
                            <DeploymentStatusBadges status={domain.deploymentStatus} />
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">{domain.statusDetail}</p>
                          {domain.ownershipStatus ? (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {domain.verificationStatus ? (
                              <Badge variant={projectDomainVerificationStatusVariant(domain.verificationStatus)}>
                                {formatProjectDomainVerificationLabel(domain.verificationStatus)}
                              </Badge>
                            ) : null}
                            <Badge variant={projectDomainOwnershipStatusVariant(domain.ownershipStatus)}>
                              {formatProjectDomainOwnershipLabel(domain.ownershipStatus)}
                            </Badge>
                            {domain.tlsStatus ? (
                              <Badge variant={projectDomainTlsStatusVariant(domain.tlsStatus)}>
                                {formatProjectDomainTlsLabel(domain.tlsStatus)}
                              </Badge>
                            ) : null}
                            {domain.diagnosticsFreshnessStatus ? (
                              <Badge variant={projectDomainDiagnosticsFreshnessVariant(domain.diagnosticsFreshnessStatus)}>
                                {formatProjectDomainDiagnosticsFreshnessLabel(domain.diagnosticsFreshnessStatus)}
                              </Badge>
                            ) : null}
                            {domain.claimState ? (
                              <Badge variant={projectDomainClaimVariant(domain.claimState)}>
                                {formatProjectDomainClaimLabel(domain.claimState)}
                              </Badge>
                            ) : null}
                          </div>
                        ) : null}
                        {domain.claimTitle ? (
                          <p className="text-xs font-medium text-foreground">
                            Claim guide: {domain.claimTitle}
                          </p>
                        ) : null}
                        {domain.claimDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.claimDetail}</p>
                        ) : null}
                        {domain.verificationDnsRecordType && domain.verificationDnsRecordName && domain.verificationDnsRecordValue ? (
                          <p className="text-xs text-muted-foreground">
                            Ownership challenge record:{' '}
                            <span className="font-mono text-foreground">
                              {domain.verificationDnsRecordType} {domain.verificationDnsRecordName} -&gt; {domain.verificationDnsRecordValue}
                            </span>
                          </p>
                        ) : null}
                        {domain.routingDnsRecordType && domain.routingDnsRecordName && domain.routingDnsRecordValue ? (
                          <p className="text-xs text-muted-foreground">
                            Routing DNS record:{' '}
                            <span className="font-mono text-foreground">
                              {domain.routingDnsRecordType} {domain.routingDnsRecordName} -&gt; {domain.routingDnsRecordValue}
                            </span>
                          </p>
                        ) : null}
                        {domain.claimDnsRecordType
                        && domain.claimDnsRecordName
                        && domain.claimDnsRecordValue
                        && (
                          domain.claimDnsRecordType !== domain.verificationDnsRecordType
                          || domain.claimDnsRecordName !== domain.verificationDnsRecordName
                          || domain.claimDnsRecordValue !== domain.verificationDnsRecordValue
                        )
                        && (
                          domain.claimDnsRecordType !== domain.routingDnsRecordType
                          || domain.claimDnsRecordName !== domain.routingDnsRecordName
                          || domain.claimDnsRecordValue !== domain.routingDnsRecordValue
                        ) ? (
                          <p className="text-xs text-muted-foreground">
                            Recommended DNS record:{' '}
                            <span className="font-mono text-foreground">
                              {domain.claimDnsRecordType} {domain.claimDnsRecordName} -&gt; {domain.claimDnsRecordValue}
                            </span>
                          </p>
                        ) : null}
                        {domain.ownershipDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.ownershipDetail}</p>
                        ) : null}
                        {domain.verificationDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.verificationDetail}</p>
                        ) : null}
                        {domain.tlsDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.tlsDetail}</p>
                        ) : null}
                        {domain.diagnosticsFreshnessDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.diagnosticsFreshnessDetail}</p>
                        ) : null}
                        {describeVerificationTimeline(domain) ? (
                          <p className="text-xs text-muted-foreground">{describeVerificationTimeline(domain)}</p>
                        ) : null}
                        {describeOwnershipTimeline(domain) ? (
                          <p className="text-xs text-muted-foreground">{describeOwnershipTimeline(domain)}</p>
                        ) : null}
                        {describeTlsTimeline(domain) ? (
                          <p className="text-xs text-muted-foreground">{describeTlsTimeline(domain)}</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {domain.diagnosticsCheckedAt
                            ? `Checks last ran ${formatRelativeTime(domain.diagnosticsCheckedAt)}`
                            : 'Checks not recorded yet. Refresh checks to persist claim-verification, DNS, and TLS status for this host.'}
                        </p>
                        {domain.verificationVerifiedAt ? (
                          <p className="text-xs text-muted-foreground">
                            Ownership claim last confirmed {formatRelativeTime(domain.verificationVerifiedAt)}
                          </p>
                        ) : null}
                        {domain.ownershipVerifiedAt ? (
                          <p className="text-xs text-muted-foreground">
                            DNS last confirmed {formatRelativeTime(domain.ownershipVerifiedAt)}
                          </p>
                        ) : null}
                        {domain.tlsReadyAt ? (
                          <p className="text-xs text-muted-foreground">
                            HTTPS last healthy {formatRelativeTime(domain.tlsReadyAt)}
                          </p>
                        ) : null}
                        {domain.recentEvents && domain.recentEvents.length > 0 ? (
                          <div className="pt-1">
                            <p className="text-xs font-medium text-foreground">Recent activity</p>
                            <div className="mt-1 space-y-1">
                              {domain.recentEvents.map((event) => (
                                <p key={event.id} className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    {formatProjectDomainEventKindLabel(event.kind)}
                                  </span>
                                  {' '}
                                  {formatProjectDomainEventStatusTransition({
                                    previousStatus: event.previousStatus,
                                    nextStatus: event.nextStatus
                                  })}
                                  {' '}
                                  {formatRelativeTime(event.createdAt)}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          Target port: <span className="font-mono text-foreground">{domain.targetPort}</span>
                          {domain.deploymentId ? (
                            <>
                              {' '}| deployment{' '}
                              <Link
                                href={`/deployments/${domain.deploymentId}`}
                                className="text-primary underline-offset-4 hover:underline"
                              >
                                {truncateUuid(domain.deploymentId)}
                              </Link>
                            </>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Updated {formatRelativeTime(domain.updatedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {canManageDomains && isCustomHost ? (
                          <form action={verifyProjectDomainClaimAction}>
                            <input type="hidden" name="projectId" value={project.id} readOnly />
                            <input type="hidden" name="domainId" value={domain.id} readOnly />
                            <input type="hidden" name="domainHost" value={domain.host} readOnly />
                            <input type="hidden" name="returnPath" value={`/projects/${project.id}/domains`} readOnly />
                            <FormSubmitButton
                              idleText={domain.verificationStatus === 'verified' ? 'Recheck Claim' : 'Verify Claim'}
                              pendingText="Verifying..."
                              size="sm"
                              variant="outline"
                            />
                          </form>
                        ) : null}
                        {domain.runtimeUrl ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={domain.runtimeUrl} target="_blank" rel="noreferrer">
                              Open Runtime URL
                            </a>
                          </Button>
                        ) : domain.routeStatus === 'pending' ? (
                          <Badge variant="outline">pending activation</Badge>
                        ) : (
                          <Badge variant="outline">runtime URL unavailable</Badge>
                        )}
                        {canRemoveDomain ? (
                          <form action={removeProjectDomainAction}>
                            <input type="hidden" name="projectId" value={project.id} readOnly />
                            <input type="hidden" name="domainId" value={domain.id} readOnly />
                            <input type="hidden" name="domainHost" value={domain.host} readOnly />
                            <input type="hidden" name="returnPath" value={`/projects/${project.id}/domains`} readOnly />
                            <FormSubmitButton
                              idleText="Remove"
                              pendingText="Removing..."
                              size="sm"
                              variant="destructive"
                            />
                          </form>
                        ) : canManageDomains && isCustomHost && hasInFlightRouteAttachment ? (
                          <Badge variant="outline">remove after deployment finishes</Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </PageLayout>
    );
  } catch (error) {
    return (
      <PageLayout>
        <DashboardUnavailableState
          title="Project domains unavailable"
          requestAuth={requestAuth}
          error={error}
          redirectTo={`/projects/${params.id}/domains`}
        />
      </PageLayout>
    );
  }
}
