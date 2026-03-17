import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { MaskedSecretValue } from '@/components/masked-secret-value';
import { ActionToast } from '@/components/action-toast';
import { PageLayout } from '@/components/page-layout';
import { EmptyState } from '@/components/empty-state';
import { LiveDataUnavailableState } from '@/components/live-data-unavailable-state';
import { FormSubmitButton } from '@/components/form-submit-button';
import {
  apiAuthToken,
  demoUserId,
  fetchProjectsForDemoUser,
  fetchEnvironmentVariables,
} from '@/lib/api';
import { describeDashboardLiveDataFailure } from '@/lib/helpers';
import Link from 'next/link';
import { saveEnvironmentVariableAction, removeEnvironmentVariableAction } from './actions';

interface EnvironmentPageProps {
  searchParams?: {
    envProjectId?: string;
    status?: 'success' | 'error';
    message?: string;
  };
}

export default async function EnvironmentPage({ searchParams }: EnvironmentPageProps) {
  let projects: Array<{ id: string; name: string }> = [];
  let environmentVariables: Array<{ key: string; value: string }> = [];
  let selectedProjectId = '';
  let selectedProjectName = '';
  let liveDataErrorMessage: string | null = null;

  if (demoUserId) {
    try {
      const apiProjects = await fetchProjectsForDemoUser();
      projects = apiProjects.map((p) => ({ id: p.id, name: p.name }));

      const selected =
        apiProjects.find((p) => p.id === searchParams?.envProjectId) ?? apiProjects[0];

      if (selected) {
        selectedProjectId = selected.id;
        selectedProjectName = selected.name;
        const envItems = await fetchEnvironmentVariables(selected.id);
        environmentVariables = envItems.map((item) => ({ key: item.key, value: item.value }));
      }
    } catch (error) {
      liveDataErrorMessage = describeDashboardLiveDataFailure({
        error,
        hasDemoUserId: true,
        hasApiAuthToken: Boolean(apiAuthToken)
      });
    }
  } else {
    liveDataErrorMessage = describeDashboardLiveDataFailure({
      hasDemoUserId: false,
      hasApiAuthToken: Boolean(apiAuthToken)
    });
  }

  const hasLiveData = Boolean(selectedProjectId);

  return (
    <PageLayout>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Environment Variables</h1>
        <p className="text-sm text-muted-foreground">
          Global shortcut for environment management. Prefer project-scoped view for day-to-day work.
        </p>
      </div>

      <ActionToast
        status={searchParams?.status}
        message={searchParams?.message}
        fallbackErrorMessage="Environment variable operation failed."
      />

      {hasLiveData ? (
        <>
          <form className="grid gap-2 md:grid-cols-[1fr_auto]">
            <Label htmlFor="env-project-id" className="sr-only">Select project</Label>
            <Select
              id="env-project-id"
              name="envProjectId"
              defaultValue={selectedProjectId}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
            <Button type="submit">Select Project</Button>
          </form>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <p>
              Editing project: <span className="font-medium text-foreground">{selectedProjectName}</span>
            </p>
            <Link href={`/projects/${selectedProjectId}/environment`} className="text-primary hover:underline">
              Open project-scoped environment
            </Link>
            <Link href={`/projects/${selectedProjectId}`} className="text-primary hover:underline">
              Open project
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add / Update Variable</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={saveEnvironmentVariableAction}
                className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
              >
                <input type="hidden" name="projectId" value={selectedProjectId} readOnly />
                <Label htmlFor="env-key" className="sr-only">Environment key</Label>
                <Input
                  id="env-key"
                  type="text"
                  name="key"
                  placeholder="KEY_NAME"
                  required
                  className="font-mono"
                />
                <Label htmlFor="env-value" className="sr-only">Environment value</Label>
                <Input
                  id="env-value"
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
                description="Add your first variable above, then redeploy to apply it to runtime containers."
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
                  <form action={removeEnvironmentVariableAction}>
                    <input type="hidden" name="projectId" value={selectedProjectId} readOnly />
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
        </>
      ) : liveDataErrorMessage ? (
        <LiveDataUnavailableState
          title="Environment management unavailable"
          description={liveDataErrorMessage}
          actionHref="/projects"
          actionLabel="Open Projects"
        />
      ) : (
        <EmptyState
          title="No projects found"
          description="Create a project first, then manage variables from this global shortcut or project-scoped environment page."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/projects">Open Projects</Link>
            </Button>
          }
        />
      )}
    </PageLayout>
  );
}
