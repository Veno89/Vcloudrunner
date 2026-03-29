import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionToast } from '@/components/action-toast';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { DashboardUnavailableState } from '@/components/dashboard-unavailable-state';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { EmptyState } from '@/components/empty-state';
import { FormSubmitButton } from '@/components/form-submit-button';
import { MaskedSecretValue } from '@/components/masked-secret-value';
import { PageLayout } from '@/components/page-layout';
import { ProjectSubnav } from '@/components/project-subnav';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  apiAuthToken,
  fetchProjectDatabases,
  fetchProjectsForCurrentUser,
  resolveViewerContext
} from '@/lib/api';
import { buildDashboardAccountSetupHref } from '@/lib/dashboard-auth-navigation';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { describeDashboardLiveDataFailure, formatRelativeTime } from '@/lib/helpers';
import {
  describeProjectDatabaseServiceLinks,
  getProjectDatabaseHealthBadge,
  getProjectDatabaseStatusBadge,
  summarizeProjectDatabases
} from '@/lib/project-databases';
import {
  createProjectDatabaseAction,
  reconcileProjectDatabaseAction,
  removeProjectDatabaseAction,
  rotateProjectDatabaseCredentialsAction,
  updateProjectDatabaseServiceLinksAction
} from './actions';

interface ProjectDatabasesPageProps {
  params: {
    id: string;
  };
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
  };
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

    let projectDatabases = [] as Awaited<ReturnType<typeof fetchProjectDatabases>>;
    let projectDatabasesReadErrorMessage: string | null = null;

    try {
      projectDatabases = await fetchProjectDatabases(project.id);
    } catch (error) {
      projectDatabasesReadErrorMessage = describeDashboardLiveDataFailure({
        error,
        hasDemoUserId: Boolean(viewer.userId),
        hasApiAuthToken: Boolean(apiAuthToken)
      });
    }

    const databaseSummary = summarizeProjectDatabases({
      databases: projectDatabases,
      databasesUnavailable: Boolean(projectDatabasesReadErrorMessage)
    });
    const readyCount = projectDatabases.filter((database) => database.status === 'ready').length;
    const healthyCount = projectDatabases.filter((database) => database.healthStatus === 'healthy').length;
    const linkedServiceCount = new Set(
      projectDatabases.flatMap((database) => database.serviceNames)
    ).size;

    return (
      <PageLayout>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          <Link href={`/projects/${project.id}`} className="hover:text-foreground">{project.name}</Link>
          <span>/</span>
          <span className="text-foreground">Databases</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Managed Databases</h1>
          <p className="text-sm text-muted-foreground">
            Provision and link managed Postgres resources for <span className="font-medium text-foreground">{project.name}</span>.
          </p>
        </div>

        <ProjectSubnav projectId={project.id} />

        {projectDatabasesReadErrorMessage ? (
          <DemoModeBanner title="Partial outage" detail={projectDatabasesReadErrorMessage}>
            Managed database data is temporarily unavailable, but you can still submit create or retry actions for this project.
          </DemoModeBanner>
        ) : null}

        {!viewer.user ? (
          <DemoModeBanner
            title="Account setup required"
            detail="Complete account setup before creating, rotating, or deleting managed databases."
          >
            <Link href={buildDashboardAccountSetupHref({ redirectTo: `/projects/${project.id}/databases` })} className="underline underline-offset-4">
              Open account setup
            </Link>
          </DemoModeBanner>
        ) : null}

        <ActionToast
          status={searchParams?.status}
          message={searchParams?.message}
          fallbackErrorMessage="Managed database action failed."
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Operational Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Managed Postgres now records provisioning and runtime health separately. Use reconcile when provisioning configuration changes or when a ready database needs a fresh runtime health check.
            </p>
            <p>
              Credential rotation updates the generated password, but already-running linked services still need a redeploy before they start using the new value.
            </p>
            <p>
              Backup scheduling and restore automation are not built yet. Keep an external backup process in place for any database you care about.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Managed Databases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-2xl font-semibold">
                  {projectDatabasesReadErrorMessage ? 'Unavailable' : projectDatabases.length}
                </p>
                <Badge variant={databaseSummary.variant}>{databaseSummary.label}</Badge>
                <p className="text-xs text-muted-foreground">{databaseSummary.detail}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Provisioned</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {projectDatabasesReadErrorMessage ? 'Unavailable' : readyCount}
              </p>
              <p className="text-xs text-muted-foreground">
                Resources that currently have generated connection details ready for linked deployments.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Runtime Healthy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {projectDatabasesReadErrorMessage ? 'Unavailable' : healthyCount}
              </p>
              <p className="text-xs text-muted-foreground">
                Ready databases whose generated credentials passed the latest runtime health query.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Linked Services</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {projectDatabasesReadErrorMessage ? 'Unavailable' : linkedServiceCount}
              </p>
              <p className="text-xs text-muted-foreground">
                Unique services that receive managed database environment variables during deploys.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Create Managed Postgres</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createProjectDatabaseAction} className="space-y-4">
              <input type="hidden" name="projectId" value={project.id} readOnly />
              <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
              <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="project-database-name">Database name</Label>
                  <Input
                    id="project-database-name"
                    name="name"
                    placeholder="primary-db"
                    required
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use a short lowercase name. This controls the generated environment key prefix, for example <span className="font-mono text-foreground">PRIMARY_DB_DATABASE_URL</span>.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Linked services</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {project.services.map((service) => (
                      <label key={service.name} className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          name="serviceName"
                          value={service.name}
                          defaultChecked={service.exposure === 'public'}
                          className="mt-1"
                        />
                        <span>
                          <span className="block font-medium">{service.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {service.kind} · {service.exposure}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Linked services receive generated Postgres connection variables on their next deployment.
                  </p>
                </div>
              </div>
              <FormSubmitButton idleText="Create Managed Postgres" pendingText="Creating..." />
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {projectDatabasesReadErrorMessage ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Current Databases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
                  <p className="font-medium text-destructive">Managed databases unavailable</p>
                  <p className="mt-1 text-xs">{projectDatabasesReadErrorMessage}</p>
                </div>
              </CardContent>
            </Card>
          ) : projectDatabases.length === 0 ? (
            <EmptyState
              title="No managed databases yet"
              description="Create a managed Postgres resource above to generate credentials and inject them into linked services on deploy."
            />
          ) : (
            projectDatabases.map((database) => {
              const statusBadge = getProjectDatabaseStatusBadge(database.status);
              const healthBadge = getProjectDatabaseHealthBadge(database.healthStatus);
              const canRotateCredentials =
                database.status === 'ready'
                && Boolean(database.connectionHost)
                && Boolean(database.connectionPort)
                && Boolean(database.connectionSslMode);

              return (
                <Card key={database.id}>
                  <CardHeader className="gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{database.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          managed postgres · created {formatRelativeTime(database.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                        <Badge variant={healthBadge.variant}>{healthBadge.label}</Badge>
                        {database.provisionedAt ? (
                          <Badge variant="outline">ready {formatRelativeTime(database.provisionedAt)}</Badge>
                        ) : null}
                        {database.credentialsRotatedAt ? (
                          <Badge variant="outline">rotated {formatRelativeTime(database.credentialsRotatedAt)}</Badge>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium">Provisioning status</p>
                      <p className="mt-1 text-sm text-muted-foreground">{database.statusDetail}</p>
                      <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                        <p>Database: <span className="font-mono text-foreground">{database.databaseName}</span></p>
                        <p>User: <span className="font-mono text-foreground">{database.username}</span></p>
                        <p>
                          Last attempt:{' '}
                          <span className="text-foreground">
                            {database.lastProvisioningAttemptAt ? formatRelativeTime(database.lastProvisioningAttemptAt) : 'not yet'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium">Runtime health</p>
                      <p className="mt-1 text-sm text-muted-foreground">{database.healthStatusDetail}</p>
                      <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                        <p>
                          Last check:{' '}
                          <span className="text-foreground">
                            {database.lastHealthCheckAt ? formatRelativeTime(database.lastHealthCheckAt) : 'not yet'}
                          </span>
                        </p>
                        <p>
                          Last healthy:{' '}
                          <span className="text-foreground">
                            {database.lastHealthyAt ? formatRelativeTime(database.lastHealthyAt) : 'not yet'}
                          </span>
                        </p>
                        <p>
                          Last health error:{' '}
                          <span className="text-foreground">
                            {database.lastHealthErrorAt ? formatRelativeTime(database.lastHealthErrorAt) : 'none recorded'}
                          </span>
                        </p>
                        <p>
                          Current state:{' '}
                          <span className="text-foreground">
                            {database.healthStatusChangedAt ? `since ${formatRelativeTime(database.healthStatusChangedAt)}` : 'no baseline yet'}
                          </span>
                        </p>
                      </div>
                      {database.healthStatus !== 'healthy' && database.consecutiveHealthCheckFailures > 0 ? (
                        <p className="mt-2 text-xs text-destructive">
                          This runtime issue has been observed across {database.consecutiveHealthCheckFailures} consecutive health check{database.consecutiveHealthCheckFailures === 1 ? '' : 's'}.
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                      <div className="space-y-3 rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">Linked services</p>
                          <p className="text-xs text-muted-foreground">
                            {describeProjectDatabaseServiceLinks(database)}
                          </p>
                        </div>
                        <form action={updateProjectDatabaseServiceLinksAction} className="space-y-3">
                          <input type="hidden" name="projectId" value={project.id} readOnly />
                          <input type="hidden" name="databaseId" value={database.id} readOnly />
                          <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                          <div className="grid gap-2 sm:grid-cols-2">
                            {project.services.map((service) => (
                              <label key={`${database.id}-${service.name}`} className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                                <input
                                  type="checkbox"
                                  name="serviceName"
                                  value={service.name}
                                  defaultChecked={database.serviceNames.includes(service.name)}
                                  className="mt-1"
                                />
                                <span>
                                  <span className="block font-medium">{service.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {service.kind} · {service.exposure}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                          <FormSubmitButton idleText="Save Linked Services" pendingText="Saving..." variant="outline" />
                        </form>
                      </div>

                      <div className="space-y-3 rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">Generated environment keys</p>
                          <p className="text-xs text-muted-foreground">
                            These keys are injected automatically into linked services on their next deployment.
                          </p>
                        </div>
                        <div className="grid gap-2 font-mono text-xs text-primary">
                          <span>{database.generatedEnvironment.databaseUrlKey}</span>
                          <span>{database.generatedEnvironment.hostKey}</span>
                          <span>{database.generatedEnvironment.portKey}</span>
                          <span>{database.generatedEnvironment.databaseNameKey}</span>
                          <span>{database.generatedEnvironment.usernameKey}</span>
                          <span>{database.generatedEnvironment.passwordKey}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2 rounded-md border p-3">
                        <p className="text-sm font-medium">Connection details</p>
                        <div className="grid gap-1 text-xs text-muted-foreground">
                          <p>Host: <span className="font-mono text-foreground">{database.connectionHost ?? 'not assigned yet'}</span></p>
                          <p>Port: <span className="font-mono text-foreground">{database.connectionPort ?? 'not assigned yet'}</span></p>
                          <p>SSL mode: <span className="font-mono text-foreground">{database.connectionSslMode ?? 'not assigned yet'}</span></p>
                          <p>Password:</p>
                          <MaskedSecretValue value={database.password} />
                        </div>
                      </div>
                      <div className="space-y-2 rounded-md border p-3">
                        <p className="text-sm font-medium">Generated connection string</p>
                        {database.connectionString ? (
                          <MaskedSecretValue value={database.connectionString} />
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            A connection string is published here once provisioning has both admin access and a runtime host configured.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">Operator guidance</p>
                      <div className="mt-2 space-y-1">
                        {database.credentialsRotatedAt && database.serviceNames.length > 0 ? (
                          <p>
                            Credentials last rotated {formatRelativeTime(database.credentialsRotatedAt)}. Redeploy {database.serviceNames.join(', ')} so those services receive the new generated password.
                          </p>
                        ) : null}
                        {database.status === 'ready' && database.healthStatus !== 'healthy' ? (
                          <p>
                            Runtime connectivity is not currently healthy. Reconcile after confirming the managed Postgres service is reachable from the platform runtime network.
                          </p>
                        ) : null}
                        <p>
                          Backups and restore are still operator-managed. Keep an external backup process in place until managed backup automation lands.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <form action={reconcileProjectDatabaseAction}>
                        <input type="hidden" name="projectId" value={project.id} readOnly />
                        <input type="hidden" name="databaseId" value={database.id} readOnly />
                        <input type="hidden" name="databaseName" value={database.name} readOnly />
                        <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                        <FormSubmitButton
                          idleText={database.status === 'ready' ? 'Reconcile + Health Check' : 'Retry Provisioning'}
                          pendingText="Running..."
                          variant="outline"
                        />
                      </form>
                      {canRotateCredentials ? (
                        <form action={rotateProjectDatabaseCredentialsAction}>
                          <input type="hidden" name="projectId" value={project.id} readOnly />
                          <input type="hidden" name="databaseId" value={database.id} readOnly />
                          <input type="hidden" name="databaseName" value={database.name} readOnly />
                          <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                          <ConfirmSubmitButton
                            label="Rotate Credentials"
                            pendingLabel="Rotating..."
                            variant="outline"
                            confirmMessage={`Rotate managed database credentials for ${database.name}? Linked services will need a redeploy to pick up the new password.`}
                          />
                        </form>
                      ) : null}
                      <form action={removeProjectDatabaseAction}>
                        <input type="hidden" name="projectId" value={project.id} readOnly />
                        <input type="hidden" name="databaseId" value={database.id} readOnly />
                        <input type="hidden" name="databaseName" value={database.name} readOnly />
                        <input type="hidden" name="returnPath" value={`/projects/${project.id}/databases`} readOnly />
                        <ConfirmSubmitButton
                          label="Delete"
                          pendingLabel="Deleting..."
                          variant="destructive"
                          confirmMessage={`Delete managed database ${database.name}? This also removes generated credentials and linked-service injection.`}
                        />
                      </form>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
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
