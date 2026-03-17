import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { MaskedSecretValue } from '@/components/masked-secret-value';
import { ActionToast } from '@/components/action-toast';
import { FormSubmitButton } from '@/components/form-submit-button';
import { ProjectSubnav } from '@/components/project-subnav';
import { PageLayout } from '@/components/page-layout';
import { EmptyState } from '@/components/empty-state';
import { LiveDataUnavailableState } from '@/components/live-data-unavailable-state';
import {
  apiAuthToken,
  demoUserId,
  fetchProjectsForDemoUser,
  fetchEnvironmentVariables,
} from '@/lib/api';
import { describeDashboardLiveDataFailure } from '@/lib/helpers';
import {
  saveProjectEnvironmentVariableAction,
  removeProjectEnvironmentVariableAction,
} from './actions';

interface ProjectEnvironmentPageProps {
  params: {
    id: string;
  };
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
  };
}

export default async function ProjectEnvironmentPage({ params, searchParams }: ProjectEnvironmentPageProps) {
  if (!demoUserId) {
    return (
      <PageLayout>
        <LiveDataUnavailableState
          description={describeDashboardLiveDataFailure({
            hasDemoUserId: false,
            hasApiAuthToken: Boolean(apiAuthToken)
          })}
        />
      </PageLayout>
    );
  }

  try {
    const projects = await fetchProjectsForDemoUser();
    const project = projects.find((item) => item.id === params.id);

    if (!project) {
      notFound();
    }

    const envItems = await fetchEnvironmentVariables(project.id);
    const environmentVariables = envItems.map((item) => ({ key: item.key, value: item.value }));

    return (
      <PageLayout>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          <Link href={`/projects/${project.id}`} className="hover:text-foreground">{project.name}</Link>
          <span>/</span>
          <span className="text-foreground">Environment</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project Environment</h1>
          <p className="text-sm text-muted-foreground">
            Manage variables for <span className="font-medium text-foreground">{project.name}</span>.
          </p>
        </div>

        <ProjectSubnav projectId={project.id} />

        <ActionToast
          status={searchParams?.status}
          message={searchParams?.message}
          fallbackErrorMessage="Environment variable operation failed."
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Add / Update Variable</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={saveProjectEnvironmentVariableAction}
              className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
            >
              <input type="hidden" name="projectId" value={project.id} readOnly />
              <Label htmlFor="project-env-key" className="sr-only">Environment key</Label>
              <Input
                id="project-env-key"
                type="text"
                name="key"
                placeholder="KEY_NAME"
                required
                className="font-mono"
              />
              <Label htmlFor="project-env-value" className="sr-only">Environment value</Label>
              <Input
                id="project-env-value"
                type="text"
                name="value"
                placeholder="value"
                required
              />
              <FormSubmitButton idleText="Save" pendingText="Saving..." />
            </form>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {environmentVariables.length === 0 ? (
            <EmptyState
              title="No environment variables yet"
              description="Add your first variable above, then redeploy to apply it to the runtime."
            />
          ) : (
            environmentVariables.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-md border px-4 py-3 transition-colors hover:bg-accent/20"
              >
                <div>
                  <p className="font-mono text-sm text-primary">{item.key}</p>
                  <MaskedSecretValue value={item.value} />
                </div>
                <form action={removeProjectEnvironmentVariableAction}>
                  <input type="hidden" name="projectId" value={project.id} readOnly />
                  <input type="hidden" name="key" value={item.key} readOnly />
                  <ConfirmSubmitButton
                    label="Delete"
                    confirmMessage={`Delete environment variable ${item.key}? This may break the running app until next deploy.`}
                    variant="outline"
                    size="sm"
                    pendingLabel="Deleting..."
                  />
                </form>
              </div>
            ))
          )}
        </div>
      </PageLayout>
    );
  } catch (error) {
    return (
      <PageLayout>
        <LiveDataUnavailableState
          title="Project environment unavailable"
          description={describeDashboardLiveDataFailure({
            error,
            hasDemoUserId: true,
            hasApiAuthToken: Boolean(apiAuthToken)
          })}
        />
      </PageLayout>
    );
  }
}
