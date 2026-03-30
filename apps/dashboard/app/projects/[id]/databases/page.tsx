import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ActionToast } from '@/components/action-toast';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { DashboardUnavailableState } from '@/components/dashboard-unavailable-state';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { EmptyState } from '@/components/empty-state';
import { FormSubmitButton } from '@/components/form-submit-button';
import { PageLayout } from '@/components/page-layout';
import { ProjectSubnav } from '@/components/project-subnav';
import {
  apiAuthToken,
  fetchProjectDatabases,
  fetchProjectMembers,
  fetchProjectsForCurrentUser,
  type ApiProjectDatabase,
  resolveViewerContext
} from '@/lib/api';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { describeDashboardLiveDataFailure, formatRelativeTime } from '@/lib/helpers';
import {
  formatProjectDatabaseBackupArtifactIntegrityLabel,
  formatProjectDatabaseBackupArtifactLifecycleLabel,
  formatProjectDatabaseBackupArtifactStorageProviderLabel,
  describeProjectDatabaseServiceLinks,
  formatProjectDatabaseBackupScheduleLabel,
  formatProjectDatabaseEventKindLabel,
  formatProjectDatabaseEventStatus,
  formatProjectDatabaseOperationKindLabel,
  formatProjectDatabaseOperationStatusLabel,
  getProjectDatabaseBackupCoverageBadge,
  getProjectDatabaseBackupExecutionBadge,
  getProjectDatabaseBackupInventoryBadge,
  getProjectDatabaseHealthBadge,
  getProjectDatabaseRestoreExerciseBadge,
  getProjectDatabaseRestoreWorkflowBadge,
  formatProjectDatabaseRestoreRequestApprovalLabel,
  formatProjectDatabaseRestoreRequestStatusLabel,
  getProjectDatabaseStatusBadge,
  summarizeProjectDatabases
} from '@/lib/project-databases';
import {
  createProjectDatabaseRestoreRequestAction,
  createProjectDatabaseAction,
  recordProjectDatabaseBackupArtifactAction,
  recordProjectDatabaseRecoveryCheckAction,
  reconcileProjectDatabaseAction,
  removeProjectDatabaseAction,
  reviewProjectDatabaseRestoreRequestAction,
  rotateProjectDatabaseCredentialsAction,
  updateProjectDatabaseBackupArtifactAction,
  updateProjectDatabaseRestoreRequestAction,
  updateProjectDatabaseBackupPolicyAction,
  updateProjectDatabaseServiceLinksAction
} from './actions';

interface ProjectDatabasesPageProps {
  params: { id: string };
  searchParams?: { status?: 'success' | 'error'; message?: string };
}

function sortProjectDatabasesForDisplay(databases: ApiProjectDatabase[]) {
  return databases.slice().sort((left, right) => left.name.localeCompare(right.name));
}

function describeBackupTimeline(database: ApiProjectDatabase) {
  if (database.restoreVerifiedAt) {
    return `Restore drill recorded ${formatRelativeTime(database.restoreVerifiedAt)}.`;
  }

  if (database.backupVerifiedAt) {
    return `Backup verification recorded ${formatRelativeTime(database.backupVerifiedAt)}.`;
  }

  if (database.backupInventory.latestProducedAt) {
    return `Latest backup artifact recorded ${formatRelativeTime(database.backupInventory.latestProducedAt)}.`;
  }

  return database.backupCoverage.status === 'documented'
    ? 'Runbook is documented, but no backup or restore verification has been recorded yet.'
    : 'Document an external backup and restore runbook before treating this database as production-ready.';
}

function formatProjectDatabaseBackupArtifactSize(sizeBytes: number | null) {
  if (typeof sizeBytes !== 'number' || sizeBytes <= 0) {
    return 'size not recorded';
  }

  const sizeMb = sizeBytes / (1024 * 1024);
  if (sizeMb >= 1024) {
    return `${(sizeMb / 1024).toFixed(1)} GB`;
  }

  return `${sizeMb.toFixed(1)} MB`;
}

function formatDateTimeLocalInputValue(value: string | null) {
  if (!value) {
    return '';
  }

  return value.slice(0, 16);
}

export default async function ProjectDatabasesPage({ params, searchParams }: ProjectDatabasesPageProps) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();

  if (!viewer) {
    return (
      <PageLayout>
        <DashboardUnavailableState
          requestAuth={requestAuth}
          {...(viewerContextError ? { error: viewerContextError } : {})}
          redirectTo={`/projects/${params.id}/databases`}
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

    let databases: Awaited<ReturnType<typeof fetchProjectDatabases>> = [];
    let databasesReadErrorMessage: string | null = null;
    let projectMembers: Awaited<ReturnType<typeof fetchProjectMembers>> = [];
    let projectMembersReadErrorMessage: string | null = null;

    try {
      databases = await fetchProjectDatabases(project.id);
    } catch (error) {
      databasesReadErrorMessage = describeDashboardLiveDataFailure({
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

    const currentViewerMembership = projectMembers.find((member) => member.userId === viewer.userId) ?? null;
    const canManageDatabases =
      Boolean(viewer.user)
      && (
        viewer.role === 'admin'
        || project.userId === viewer.userId
        || currentViewerMembership?.role === 'admin'
      );
    const sortedDatabases = sortProjectDatabasesForDisplay(databases);
    const summary = summarizeProjectDatabases({
      databases: sortedDatabases,
      databasesUnavailable: Boolean(databasesReadErrorMessage)
    });
    const readyCount = sortedDatabases.filter((database) => database.status === 'ready').length;
    const healthyCount = sortedDatabases.filter((database) => database.healthStatus === 'healthy').length;
    const backupOnScheduleCount = sortedDatabases.filter(
      (database) => database.backupExecution.status === 'scheduled' || database.backupExecution.status === 'custom'
    ).length;
    const recoveryVerifiedCount = sortedDatabases.filter(
      (database) => database.restoreExercise.status === 'verified'
    ).length;
    const operationAttentionCount = sortedDatabases.filter((database) =>
      database.backupExecution.status === 'attention'
      || database.backupExecution.status === 'overdue'
      || database.restoreExercise.status === 'attention'
    ).length;
    const artifactRecordedCount = sortedDatabases.filter(
      (database) => database.backupInventory.status !== 'missing'
    ).length;
    const activeRestoreRequestCount = sortedDatabases.filter(
      (database) =>
        database.restoreWorkflow.status === 'awaiting-approval'
        || database.restoreWorkflow.status === 'approved'
        || database.restoreWorkflow.status === 'in-progress'
    ).length;
    const partialOutageDetail = [
      databasesReadErrorMessage ? `Managed database data unavailable. ${databasesReadErrorMessage}` : null,
      projectMembersReadErrorMessage ? `Project membership visibility unavailable. ${projectMembersReadErrorMessage}` : null
    ].filter((message): message is string => Boolean(message)).join(' ');

    return (
      <PageLayout>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          <Link href={`/projects/${project.id}`} className="hover:text-foreground">{project.name}</Link>
          <span>/</span>
          <span className="text-foreground">Databases</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Managed Databases</h1>
            <p className="text-sm text-muted-foreground">
              Managed Postgres resources, runtime health, credential rotation, backup inventory, and restore workflow visibility for{' '}
              <span className="font-medium text-foreground">{project.name}</span>.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={summary.variant}>{summary.label}</Badge>
              <p className="text-xs text-muted-foreground">{summary.detail}</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}`}>Back to Project</Link>
          </Button>
        </div>

        <ProjectSubnav projectId={project.id} />

        <ActionToast
          status={searchParams?.status}
          message={searchParams?.message}
          fallbackErrorMessage="Managed database action failed."
        />

        {partialOutageDetail ? (
          <DemoModeBanner title="Partial outage" detail={partialOutageDetail}>
            Database management is still available, but some live status panels may be incomplete until API reads recover.
          </DemoModeBanner>
        ) : null}

        <DemoModeBanner
          title="Operator-owned backups"
          detail="Managed Postgres currently tracks external backup coverage, backup artifacts, restore approval state, and restore workflows. Backup execution and restore execution are still operator-managed."
        >
          Document where backups run, what artifacts exist, who approved a restore workflow, and how execution is being handled outside the platform.
        </DemoModeBanner>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Card><CardHeader><CardTitle className="text-sm">Configured</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{databasesReadErrorMessage ? 'Unavailable' : sortedDatabases.length}</p><p className="text-xs text-muted-foreground">{databasesReadErrorMessage ? 'Inventory could not be loaded.' : `${readyCount} provisioned and ${Math.max(sortedDatabases.length - readyCount, 0)} still in setup.`}</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Healthy</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{databasesReadErrorMessage ? 'Unavailable' : healthyCount}</p><p className="text-xs text-muted-foreground">{databasesReadErrorMessage ? 'Runtime health unavailable.' : 'Persisted runtime health checks.'}</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Backups On Schedule</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{databasesReadErrorMessage ? 'Unavailable' : backupOnScheduleCount}</p><p className="text-xs text-muted-foreground">{databasesReadErrorMessage ? 'Backup schedule status unavailable.' : 'Databases whose latest successful backup run still matches the documented cadence.'}</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Restore Verified</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{databasesReadErrorMessage ? 'Unavailable' : recoveryVerifiedCount}</p><p className="text-xs text-muted-foreground">{databasesReadErrorMessage ? 'Restore status unavailable.' : operationAttentionCount > 0 ? `${operationAttentionCount} database${operationAttentionCount === 1 ? '' : 's'} still have failed or overdue backup/restore operations.` : 'Restore drills are recorded and current issues are not active.'}</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Artifacts Recorded</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{databasesReadErrorMessage ? 'Unavailable' : artifactRecordedCount}</p><p className="text-xs text-muted-foreground">{databasesReadErrorMessage ? 'Artifact inventory unavailable.' : 'Databases with at least one recorded backup artifact.'}</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Restore Requests Open</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{databasesReadErrorMessage ? 'Unavailable' : activeRestoreRequestCount}</p><p className="text-xs text-muted-foreground">{databasesReadErrorMessage ? 'Restore workflow unavailable.' : activeRestoreRequestCount > 0 ? 'Latest restore requests still need approval or execution follow-through.' : 'No restore requests are currently waiting or in progress.'}</p></CardContent></Card>
        </div>

        {viewer.user && canManageDatabases ? (
          <Card>
            <CardHeader><CardTitle className="text-sm">Create Managed Postgres</CardTitle></CardHeader>
            <CardContent>
              <form action={createProjectDatabaseAction} className="space-y-4">
                <input type="hidden" name="projectId" value={project.id} readOnly />
                <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                  <div className="space-y-2">
                    <Label htmlFor="project-database-name">Database Name</Label>
                    <Input id="project-database-name" type="text" name="name" placeholder="primary-db" pattern="^[a-z][a-z0-9-]*$" required />
                    <p className="text-xs text-muted-foreground">Used to derive generated database/user names and injected env keys.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Link Services</Label>
                    <div className="grid gap-2 rounded-md border p-3 md:grid-cols-2">
                      {project.services.map((service) => (
                        <label key={service.name} className="flex items-start gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent/20">
                          <input type="checkbox" name="serviceName" value={service.name} className="mt-1" />
                          <span>
                            <span className="font-medium text-foreground">{service.name}</span>
                            <span className="block text-xs text-muted-foreground">{service.kind} | {service.exposure} | {service.sourceRoot}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <FormSubmitButton idleText="Create Database" pendingText="Creating..." />
              </form>
            </CardContent>
          </Card>
        ) : null}

        {databasesReadErrorMessage ? (
          <Card><CardHeader><CardTitle className="text-sm">Managed Databases Unavailable</CardTitle></CardHeader><CardContent><div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground"><p className="font-medium text-destructive">Managed database data unavailable</p><p className="mt-1 text-xs">{databasesReadErrorMessage}</p></div></CardContent></Card>
        ) : sortedDatabases.length === 0 ? (
          <EmptyState
            title="No managed databases yet"
            description="Create a managed Postgres resource to provision generated credentials, inject service env vars, and start documenting backup coverage."
          />
        ) : (
          <div className="space-y-4">
            {sortedDatabases.map((database) => {
              const statusBadge = getProjectDatabaseStatusBadge(database.status);
              const healthBadge = getProjectDatabaseHealthBadge(database.healthStatus);
              const backupBadge = getProjectDatabaseBackupCoverageBadge(database.backupCoverage.status);
              const backupExecutionBadge = getProjectDatabaseBackupExecutionBadge(database.backupExecution.status);
              const restoreExerciseBadge = getProjectDatabaseRestoreExerciseBadge(database.restoreExercise.status);
              const backupInventoryBadge = getProjectDatabaseBackupInventoryBadge(database.backupInventory.status);
              const restoreWorkflowBadge = getProjectDatabaseRestoreWorkflowBadge(database.restoreWorkflow.status);
              const canRotateCredentials =
                canManageDatabases
                && database.status === 'ready'
                && Boolean(database.connectionHost)
                && typeof database.connectionPort === 'number'
                && Boolean(database.connectionSslMode);

              return (
                <Card key={database.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base">{database.name}</CardTitle>
                          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                          <Badge variant={healthBadge.variant}>{healthBadge.label}</Badge>
                          <Badge variant={backupBadge.variant}>{backupBadge.label}</Badge>
                          <Badge variant={backupExecutionBadge.variant}>{backupExecutionBadge.label}</Badge>
                          <Badge variant={restoreExerciseBadge.variant}>{restoreExerciseBadge.label}</Badge>
                          <Badge variant={backupInventoryBadge.variant}>{backupInventoryBadge.label}</Badge>
                          <Badge variant={restoreWorkflowBadge.variant}>{restoreWorkflowBadge.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{database.statusDetail}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/api/project-database-audit?projectId=${project.id}&databaseId=${database.id}`}>
                            Export Audit JSON
                          </Link>
                        </Button>
                        {canManageDatabases ? (
                          <form action={reconcileProjectDatabaseAction}>
                            <input type="hidden" name="projectId" value={project.id} readOnly />
                            <input type="hidden" name="databaseId" value={database.id} readOnly />
                            <input type="hidden" name="databaseName" value={database.name} readOnly />
                            <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                            <FormSubmitButton idleText="Reconcile" pendingText="Reconciling..." size="sm" variant="outline" />
                          </form>
                        ) : null}
                        {canRotateCredentials ? (
                          <form action={rotateProjectDatabaseCredentialsAction}>
                            <input type="hidden" name="projectId" value={project.id} readOnly />
                            <input type="hidden" name="databaseId" value={database.id} readOnly />
                            <input type="hidden" name="databaseName" value={database.name} readOnly />
                            <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                            <ConfirmSubmitButton label="Rotate Credentials" pendingLabel="Rotating..." confirmMessage={`Rotate credentials for ${database.name}? Linked services must be redeployed afterward.`} size="sm" variant="outline" />
                          </form>
                        ) : null}
                        {canManageDatabases ? (
                          <form action={removeProjectDatabaseAction}>
                            <input type="hidden" name="projectId" value={project.id} readOnly />
                            <input type="hidden" name="databaseId" value={database.id} readOnly />
                            <input type="hidden" name="databaseName" value={database.name} readOnly />
                            <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                            <ConfirmSubmitButton label="Delete" pendingLabel="Deleting..." confirmMessage={`Delete ${database.name}? This removes the managed database record and attempts deprovisioning.`} size="sm" variant="destructive" />
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="space-y-3 rounded-md border p-3 text-xs text-muted-foreground">
                        <p className="text-sm font-medium text-foreground">Runtime Details</p>
                        <p>Database: <span className="font-mono text-foreground">{database.databaseName}</span></p>
                        <p>Username: <span className="font-mono text-foreground">{database.username}</span></p>
                        <p>Host <span className="font-mono text-foreground">{database.connectionHost ?? 'not provisioned'}</span> | port <span className="font-mono text-foreground">{database.connectionPort ?? 'n/a'}</span> | ssl <span className="font-mono text-foreground">{database.connectionSslMode ?? 'n/a'}</span></p>
                        <p>{database.healthStatusDetail}</p>
                        {database.provisionedAt ? <p>Provisioned {formatRelativeTime(database.provisionedAt)}.</p> : null}
                        {database.lastHealthCheckAt ? <p>Last health check {formatRelativeTime(database.lastHealthCheckAt)}.</p> : null}
                        {database.credentialsRotatedAt ? <p>Credentials rotated {formatRelativeTime(database.credentialsRotatedAt)}.</p> : null}
                        {database.lastErrorAt ? <p>Last provisioning error {formatRelativeTime(database.lastErrorAt)}.</p> : null}
                        {database.consecutiveHealthCheckFailures > 0 ? <p>Consecutive runtime health failures: <span className="font-medium text-foreground">{database.consecutiveHealthCheckFailures}</span></p> : null}
                      </div>

                      <div className="space-y-3 rounded-md border p-3 text-xs text-muted-foreground">
                        <p className="text-sm font-medium text-foreground">Backup Coverage</p>
                        <p>{database.backupCoverage.title}</p>
                        <p>{database.backupCoverage.detail}</p>
                        <p>{database.backupExecution.title}</p>
                        <p>{database.backupExecution.detail}</p>
                        <p>{database.restoreExercise.title}</p>
                        <p>{database.restoreExercise.detail}</p>
                        <p>{database.backupInventory.title}</p>
                        <p>{database.backupInventory.detail}</p>
                        <p>{database.restoreWorkflow.title}</p>
                        <p>{database.restoreWorkflow.detail}</p>
                        <p>Backup mode <span className="font-medium text-foreground">{database.backupMode === 'external' ? 'external runbook' : 'none documented'}</span> | cadence <span className="font-medium text-foreground">{formatProjectDatabaseBackupScheduleLabel(database.backupSchedule)}</span></p>
                        <p>{describeBackupTimeline(database)}</p>
                        {database.backupExecution.nextDueAt ? <p>Next backup due {formatRelativeTime(database.backupExecution.nextDueAt)}.</p> : null}
                        {database.backupExecution.lastRecordedAt ? <p>Latest backup run {formatRelativeTime(database.backupExecution.lastRecordedAt)}.</p> : null}
                        {database.restoreExercise.lastRecordedAt ? <p>Latest restore drill {formatRelativeTime(database.restoreExercise.lastRecordedAt)}.</p> : null}
                        {database.backupInventory.latestProducedAt ? <p>Latest artifact {formatRelativeTime(database.backupInventory.latestProducedAt)}.</p> : null}
                        {database.backupInventory.latestVerifiedAt ? <p>Latest verified artifact {formatRelativeTime(database.backupInventory.latestVerifiedAt)}.</p> : null}
                        {database.restoreWorkflow.latestRequestedAt ? <p>Latest restore request {formatRelativeTime(database.restoreWorkflow.latestRequestedAt)}.</p> : null}
                        {database.backupVerifiedAt ? <p>Backup verification {formatRelativeTime(database.backupVerifiedAt)}.</p> : null}
                        {database.restoreVerifiedAt ? <p>Restore drill {formatRelativeTime(database.restoreVerifiedAt)}.</p> : null}
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <form action={updateProjectDatabaseServiceLinksAction} className="space-y-3 rounded-md border p-3">
                        <input type="hidden" name="projectId" value={project.id} readOnly />
                        <input type="hidden" name="databaseId" value={database.id} readOnly />
                        <input type="hidden" name="databaseName" value={database.name} readOnly />
                        <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                        <p className="text-sm font-medium text-foreground">Linked Services</p>
                        <p className="text-xs text-muted-foreground">{describeProjectDatabaseServiceLinks(database)}</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          {project.services.map((service) => (
                            <label key={`${database.id}:${service.name}`} className="flex items-start gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent/20">
                              <input type="checkbox" name="serviceName" value={service.name} defaultChecked={database.serviceNames.includes(service.name)} className="mt-1" disabled={!canManageDatabases} />
                              <span>
                                <span className="font-medium text-foreground">{service.name}</span>
                                <span className="block text-xs text-muted-foreground">{service.kind} | {service.exposure}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">Injected env keys use the <span className="font-mono text-foreground">{database.generatedEnvironment.prefix}</span> prefix.</p>
                        {canManageDatabases ? <FormSubmitButton idleText="Save Linked Services" pendingText="Saving..." size="sm" variant="outline" /> : null}
                      </form>

                      <div className="space-y-3 rounded-md border p-3">
                        <form action={updateProjectDatabaseBackupPolicyAction} className="space-y-3">
                          <input type="hidden" name="projectId" value={project.id} readOnly />
                          <input type="hidden" name="databaseId" value={database.id} readOnly />
                          <input type="hidden" name="databaseName" value={database.name} readOnly />
                          <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                          <p className="text-sm font-medium text-foreground">Backup Runbook</p>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`backup-mode-${database.id}`}>Backup mode</Label>
                              <Select id={`backup-mode-${database.id}`} name="backupMode" defaultValue={database.backupMode} disabled={!canManageDatabases}>
                                <option value="none">No documented coverage</option>
                                <option value="external">External runbook</option>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`backup-schedule-${database.id}`}>Backup cadence</Label>
                              <Select id={`backup-schedule-${database.id}`} name="backupSchedule" defaultValue={database.backupSchedule ?? 'daily'} disabled={!canManageDatabases}>
                                <option value="daily">daily</option>
                                <option value="weekly">weekly</option>
                                <option value="monthly">monthly</option>
                                <option value="custom">custom</option>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`backup-runbook-${database.id}`}>Runbook</Label>
                            <textarea id={`backup-runbook-${database.id}`} name="backupRunbook" defaultValue={database.backupRunbook} rows={5} disabled={!canManageDatabases} className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" placeholder="Document backup execution, retention, verification, restore steps, and operator ownership." />
                          </div>
                          {canManageDatabases ? <FormSubmitButton idleText="Save Backup Coverage" pendingText="Saving..." size="sm" variant="outline" /> : null}
                        </form>

                        {canManageDatabases ? (
                          <form action={recordProjectDatabaseRecoveryCheckAction} className="space-y-3 rounded-md border border-dashed p-3">
                            <input type="hidden" name="projectId" value={project.id} readOnly />
                            <input type="hidden" name="databaseId" value={database.id} readOnly />
                            <input type="hidden" name="databaseName" value={database.name} readOnly />
                            <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                            <p className="text-sm font-medium text-foreground">Operation Journal</p>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor={`operation-kind-${database.id}`}>Operation</Label>
                                <Select id={`operation-kind-${database.id}`} name="kind" defaultValue="backup">
                                  <option value="backup">backup run</option>
                                  <option value="restore">restore drill</option>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`operation-status-${database.id}`}>Outcome</Label>
                                <Select id={`operation-status-${database.id}`} name="status" defaultValue="succeeded">
                                  <option value="succeeded">succeeded</option>
                                  <option value="failed">failed</option>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`operation-summary-${database.id}`}>Summary</Label>
                              <Input
                                id={`operation-summary-${database.id}`}
                                type="text"
                                name="summary"
                                placeholder="Nightly pg_dump finished successfully"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`operation-detail-${database.id}`}>Notes</Label>
                              <textarea
                                id={`operation-detail-${database.id}`}
                                name="detail"
                                rows={3}
                                className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                placeholder="Capture restore target, retention snapshot, failure context, or any follow-up needed."
                              />
                            </div>
                            <FormSubmitButton idleText="Record Operation" pendingText="Recording..." size="sm" variant="outline" />
                          </form>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="space-y-3 rounded-md border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">Backup Artifact Inventory</p>
                          <Badge variant="outline">{database.backupArtifacts.length}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Record where backup snapshots live, how long they stay retained, whether integrity has been checked, and whether each artifact is still active, archived, or purged from the recovery path.
                        </p>
                        {canManageDatabases ? (
                          <form action={recordProjectDatabaseBackupArtifactAction} className="space-y-3 rounded-md border border-dashed p-3">
                            <input type="hidden" name="projectId" value={project.id} readOnly />
                            <input type="hidden" name="databaseId" value={database.id} readOnly />
                            <input type="hidden" name="databaseName" value={database.name} readOnly />
                            <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor={`artifact-label-${database.id}`}>Artifact label</Label>
                                <Input
                                  id={`artifact-label-${database.id}`}
                                  type="text"
                                  name="label"
                                  placeholder="nightly-2026-03-30"
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`artifact-storage-${database.id}`}>Storage</Label>
                                <Select id={`artifact-storage-${database.id}`} name="storageProvider" defaultValue="s3">
                                  <option value="s3">s3</option>
                                  <option value="gcs">gcs</option>
                                  <option value="azure">azure</option>
                                  <option value="local">local</option>
                                  <option value="other">other</option>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`artifact-location-${database.id}`}>Location</Label>
                              <Input
                                id={`artifact-location-${database.id}`}
                                type="text"
                                name="location"
                                placeholder="s3://platform-backups/example-project/primary-db/nightly-2026-03-30.dump"
                                required
                              />
                            </div>
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="space-y-2">
                                <Label htmlFor={`artifact-produced-at-${database.id}`}>Produced at</Label>
                                <Input id={`artifact-produced-at-${database.id}`} type="datetime-local" name="producedAt" required />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`artifact-retention-${database.id}`}>Retention ends</Label>
                                <Input id={`artifact-retention-${database.id}`} type="datetime-local" name="retentionExpiresAt" />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`artifact-size-${database.id}`}>Size (MB)</Label>
                                <Input id={`artifact-size-${database.id}`} type="number" min="0" step="0.1" name="sizeMb" placeholder="512" />
                              </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor={`artifact-integrity-${database.id}`}>Integrity</Label>
                                <Select id={`artifact-integrity-${database.id}`} name="integrityStatus" defaultValue="unknown">
                                  <option value="unknown">unverified</option>
                                  <option value="verified">verified</option>
                                  <option value="failed">failed</option>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`artifact-detail-${database.id}`}>Notes</Label>
                              <textarea
                                id={`artifact-detail-${database.id}`}
                                name="detail"
                                rows={3}
                                className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                placeholder="Checksum verified against object storage copy, retention ticket, or any follow-up needed."
                              />
                            </div>
                            <FormSubmitButton idleText="Record Artifact" pendingText="Recording..." size="sm" variant="outline" />
                          </form>
                        ) : null}

                        {database.backupArtifacts.length > 0 ? (
                          <div className="space-y-2">
                            {database.backupArtifacts.map((artifact) => (
                              <div key={artifact.id} className="rounded-md border px-3 py-2">
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{artifact.label}</span>
                                  {' '}|{' '}
                                  {formatProjectDatabaseBackupArtifactStorageProviderLabel(artifact.storageProvider)}
                                  {' '}|{' '}
                                  <span className={artifact.integrityStatus === 'failed' ? 'text-destructive' : 'text-foreground'}>
                                    {formatProjectDatabaseBackupArtifactIntegrityLabel(artifact.integrityStatus)}
                                  </span>
                                  {' '}|{' '}
                                  {formatProjectDatabaseBackupArtifactLifecycleLabel(artifact.lifecycleStatus)}
                                  {' '}|{' '}
                                  {formatProjectDatabaseBackupArtifactSize(artifact.sizeBytes)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">{artifact.location}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Produced {formatRelativeTime(artifact.producedAt)}
                                  {artifact.retentionExpiresAt ? ` | retention ends ${formatRelativeTime(artifact.retentionExpiresAt)}` : ''}
                                  {artifact.verifiedAt ? ` | verified ${formatRelativeTime(artifact.verifiedAt)}` : ''}
                                </p>
                                {artifact.detail ? (
                                  <p className="mt-1 text-xs text-muted-foreground">{artifact.detail}</p>
                                ) : null}
                                {canManageDatabases ? (
                                  <form action={updateProjectDatabaseBackupArtifactAction} className="mt-3 space-y-3 rounded-md border border-dashed p-3">
                                    <input type="hidden" name="projectId" value={project.id} readOnly />
                                    <input type="hidden" name="databaseId" value={database.id} readOnly />
                                    <input type="hidden" name="databaseName" value={database.name} readOnly />
                                    <input type="hidden" name="backupArtifactId" value={artifact.id} readOnly />
                                    <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                                    <div className="grid gap-3 md:grid-cols-3">
                                      <div className="space-y-2">
                                        <Label htmlFor={`artifact-update-integrity-${artifact.id}`}>Integrity</Label>
                                        <Select
                                          id={`artifact-update-integrity-${artifact.id}`}
                                          name="integrityStatus"
                                          defaultValue={artifact.integrityStatus}
                                        >
                                          <option value="unknown">unverified</option>
                                          <option value="verified">verified</option>
                                          <option value="failed">failed</option>
                                        </Select>
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor={`artifact-update-lifecycle-${artifact.id}`}>Lifecycle</Label>
                                        <Select
                                          id={`artifact-update-lifecycle-${artifact.id}`}
                                          name="lifecycleStatus"
                                          defaultValue={artifact.lifecycleStatus}
                                        >
                                          <option value="active">active</option>
                                          <option value="archived">archived</option>
                                          <option value="purged">purged</option>
                                        </Select>
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor={`artifact-update-retention-${artifact.id}`}>Retention ends</Label>
                                        <Input
                                          id={`artifact-update-retention-${artifact.id}`}
                                          type="datetime-local"
                                          name="retentionExpiresAt"
                                          defaultValue={formatDateTimeLocalInputValue(artifact.retentionExpiresAt)}
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor={`artifact-update-detail-${artifact.id}`}>Lifecycle notes</Label>
                                      <textarea
                                        id={`artifact-update-detail-${artifact.id}`}
                                        name="detail"
                                        rows={2}
                                        defaultValue={artifact.detail}
                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        placeholder="Record why this artifact was archived, purged, or re-verified."
                                      />
                                    </div>
                                    <FormSubmitButton idleText="Save Artifact Controls" pendingText="Saving..." size="sm" variant="outline" />
                                  </form>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No backup artifacts have been recorded yet for this database.</p>
                        )}
                      </div>

                      <div className="space-y-3 rounded-md border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">Restore Requests</p>
                          <Badge variant="outline">{database.restoreRequests.length}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Track operator-owned restore workflows, approval state, execution progress, and handoff details even though execution still happens outside the platform.
                        </p>
                        {canManageDatabases ? (
                          <form action={createProjectDatabaseRestoreRequestAction} className="space-y-3 rounded-md border border-dashed p-3">
                            <input type="hidden" name="projectId" value={project.id} readOnly />
                            <input type="hidden" name="databaseId" value={database.id} readOnly />
                            <input type="hidden" name="databaseName" value={database.name} readOnly />
                            <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor={`restore-target-${database.id}`}>Target</Label>
                                <Input
                                  id={`restore-target-${database.id}`}
                                  type="text"
                                  name="target"
                                  placeholder="staging verification environment"
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`restore-artifact-${database.id}`}>Backup artifact</Label>
                                <Select id={`restore-artifact-${database.id}`} name="backupArtifactId" defaultValue="">
                                  <option value="">latest available / not specified</option>
                                  {database.backupArtifacts
                                    .filter((artifact) => artifact.lifecycleStatus !== 'purged')
                                    .map((artifact) => (
                                    <option key={artifact.id} value={artifact.id}>
                                      {artifact.label} ({formatProjectDatabaseBackupArtifactLifecycleLabel(artifact.lifecycleStatus)})
                                    </option>
                                  ))}
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`restore-summary-${database.id}`}>Summary</Label>
                              <Input
                                id={`restore-summary-${database.id}`}
                                type="text"
                                name="summary"
                                placeholder="Verify point-in-time restore before enabling schema migration"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`restore-detail-${database.id}`}>Notes</Label>
                              <textarea
                                id={`restore-detail-${database.id}`}
                                name="detail"
                                rows={3}
                                className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                placeholder="Capture expected validation steps, operator owner, or escalation notes."
                              />
                            </div>
                            <FormSubmitButton idleText="Create Restore Request" pendingText="Creating..." size="sm" variant="outline" />
                          </form>
                        ) : null}

                        {database.restoreRequests.length > 0 ? (
                          <div className="space-y-2">
                            {database.restoreRequests.map((request) => (
                              <div key={request.id} className="rounded-md border px-3 py-2">
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{request.summary}</span>
                                  {' '}|{' '}
                                  <span className={
                                    request.status === 'failed'
                                      ? 'text-destructive'
                                      : request.status === 'succeeded'
                                        ? 'text-foreground'
                                        : 'text-muted-foreground'
                                  }>
                                    {formatProjectDatabaseRestoreRequestStatusLabel(request.status)}
                                  </span>
                                  {' '}|{' '}
                                  {formatProjectDatabaseRestoreRequestApprovalLabel(request.approvalStatus)}
                                  {' '}|{' '}
                                  {request.target}
                                </p>
                                {request.backupArtifactLabel ? (
                                  <p className="mt-1 text-xs text-muted-foreground">Artifact: {request.backupArtifactLabel}</p>
                                ) : null}
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Requested {formatRelativeTime(request.requestedAt)}
                                  {request.approvalReviewedAt ? ` | reviewed ${formatRelativeTime(request.approvalReviewedAt)}` : ''}
                                  {request.startedAt ? ` | started ${formatRelativeTime(request.startedAt)}` : ''}
                                  {request.completedAt ? ` | completed ${formatRelativeTime(request.completedAt)}` : ''}
                                </p>
                                {request.approvalDetail ? (
                                  <p className="mt-1 text-xs text-muted-foreground">Approval: {request.approvalDetail}</p>
                                ) : null}
                                {request.detail ? (
                                  <p className="mt-1 text-xs text-muted-foreground">{request.detail}</p>
                                ) : null}
                                {canManageDatabases ? (
                                  <div className="mt-3 space-y-3">
                                    {request.status === 'requested' ? (
                                      <form action={reviewProjectDatabaseRestoreRequestAction} className="space-y-3 rounded-md border border-dashed p-3">
                                        <input type="hidden" name="projectId" value={project.id} readOnly />
                                        <input type="hidden" name="databaseId" value={database.id} readOnly />
                                        <input type="hidden" name="databaseName" value={database.name} readOnly />
                                        <input type="hidden" name="restoreRequestId" value={request.id} readOnly />
                                        <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                                        <div className="space-y-2">
                                          <Label htmlFor={`restore-request-approval-${request.id}`}>Approval</Label>
                                          <Select
                                            id={`restore-request-approval-${request.id}`}
                                            name="approvalStatus"
                                            defaultValue={request.approvalStatus === 'rejected' ? 'rejected' : 'approved'}
                                          >
                                            <option value="approved">approved</option>
                                            <option value="rejected">rejected</option>
                                          </Select>
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor={`restore-request-approval-detail-${request.id}`}>Approval notes</Label>
                                          <textarea
                                            id={`restore-request-approval-detail-${request.id}`}
                                            name="approvalDetail"
                                            rows={2}
                                            defaultValue={request.approvalDetail}
                                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                            placeholder="Record who approved this workflow, what target is expected, or why it was rejected."
                                          />
                                        </div>
                                        <FormSubmitButton idleText="Save Approval" pendingText="Saving..." size="sm" variant="outline" />
                                      </form>
                                    ) : null}
                                    <form action={updateProjectDatabaseRestoreRequestAction} className="space-y-3 rounded-md border border-dashed p-3">
                                      <input type="hidden" name="projectId" value={project.id} readOnly />
                                      <input type="hidden" name="databaseId" value={database.id} readOnly />
                                      <input type="hidden" name="databaseName" value={database.name} readOnly />
                                      <input type="hidden" name="restoreRequestId" value={request.id} readOnly />
                                      <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                                      <div className="space-y-2">
                                        <Label htmlFor={`restore-request-status-${request.id}`}>Status</Label>
                                        <Select id={`restore-request-status-${request.id}`} name="status" defaultValue={request.status}>
                                          <option value="requested">requested</option>
                                          {request.approvalStatus === 'approved' ? (
                                            <>
                                              <option value="in_progress">in progress</option>
                                              <option value="succeeded">succeeded</option>
                                              <option value="failed">failed</option>
                                            </>
                                          ) : null}
                                          <option value="cancelled">cancelled</option>
                                        </Select>
                                      </div>
                                      {request.approvalStatus !== 'approved' && request.status === 'requested' ? (
                                        <p className="text-xs text-muted-foreground">
                                          Approval is required before this restore workflow can move into execution.
                                        </p>
                                      ) : null}
                                      <div className="space-y-2">
                                        <Label htmlFor={`restore-request-detail-${request.id}`}>Update notes</Label>
                                        <textarea
                                          id={`restore-request-detail-${request.id}`}
                                          name="detail"
                                          rows={3}
                                          defaultValue={request.detail}
                                          className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                          placeholder="Record the latest operator note for this restore workflow."
                                        />
                                      </div>
                                      <FormSubmitButton idleText="Update Restore Request" pendingText="Saving..." size="sm" variant="outline" />
                                    </form>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No restore requests have been recorded yet for this database.</p>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">Operation History</p>
                        <Badge variant="outline">{database.recentOperations.length}</Badge>
                      </div>
                      {database.recentOperations.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {database.recentOperations.map((operation) => (
                            <div key={operation.id} className="rounded-md border px-3 py-2">
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  {formatProjectDatabaseOperationKindLabel(operation.kind)}
                                </span>
                                {' '}
                                <span className={operation.status === 'failed' ? 'text-destructive' : 'text-foreground'}>
                                  {formatProjectDatabaseOperationStatusLabel(operation.status)}
                                </span>
                                {' '}
                                {formatRelativeTime(operation.recordedAt)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">{operation.summary}</p>
                              {operation.detail ? (
                                <p className="mt-1 text-xs text-muted-foreground">{operation.detail}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">No backup or restore operations have been recorded yet for this database.</p>
                      )}
                    </div>

                    <div className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">Recent Activity</p>
                        <Badge variant="outline">{database.recentEvents.length}</Badge>
                      </div>
                      {database.recentEvents.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {database.recentEvents.map((event) => (
                            <div key={event.id} className="rounded-md border px-3 py-2">
                              <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{formatProjectDatabaseEventKindLabel(event.kind)}</span> {formatProjectDatabaseEventStatus(event)} {formatRelativeTime(event.createdAt)}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{event.detail}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">No database events have been recorded yet for this resource.</p>
                      )}
                    </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </PageLayout>
    );
  } catch (error) {
    return (
      <PageLayout>
        <DashboardUnavailableState
          title="Project databases unavailable"
          requestAuth={requestAuth}
          error={error}
          redirectTo={`/projects/${params.id}/databases`}
        />
      </PageLayout>
    );
  }
}
