import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { MaskedSecretValue } from '@/components/masked-secret-value';
import {
  demoUserId,
  fetchProjectsForDemoUser,
  fetchEnvironmentVariables,
} from '@/lib/api';
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
    } catch {
      // will show empty state
    }
  }

  const hasLiveData = Boolean(demoUserId && selectedProjectId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Environment Variables</h1>
        <p className="text-sm text-muted-foreground">
          Manage environment variables per project.
        </p>
      </div>

      {searchParams?.status === 'success' && searchParams.message && (
        <div className="rounded-md border border-emerald-700/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          {decodeURIComponent(searchParams.message)}
        </div>
      )}
      {searchParams?.status === 'error' && (
        <div className="rounded-md border border-rose-700/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {searchParams.message ? decodeURIComponent(searchParams.message) : 'Operation failed'}
        </div>
      )}

      {hasLiveData ? (
        <>
          <form className="grid gap-2 md:grid-cols-[1fr_auto]">
            <select
              name="envProjectId"
              defaultValue={selectedProjectId}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Select Project
            </button>
          </form>

          <p className="text-xs text-muted-foreground">
            Editing project: <span className="font-medium text-foreground">{selectedProjectName}</span>
          </p>

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
                <input
                  type="text"
                  name="key"
                  placeholder="KEY_NAME"
                  required
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                />
                <input
                  type="text"
                  name="value"
                  placeholder="value"
                  required
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Save
                </button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {environmentVariables.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No variables set yet. Add your first variable above.
                </CardContent>
              </Card>
            ) : (
              environmentVariables.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-md border px-4 py-3"
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
                      className="rounded-md border border-destructive px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                    />
                  </form>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {demoUserId
              ? 'No projects found. Create a project first.'
              : 'Environment editor requires a demo user context. Set NEXT_PUBLIC_DEMO_USER_ID.'}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
