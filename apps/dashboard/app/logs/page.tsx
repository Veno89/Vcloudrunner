import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogsAutoRefresh } from '@/components/logs-auto-refresh';
import { LogsLiveStream } from '@/components/logs-live-stream';
import {
  demoUserId,
  fetchProjectsForDemoUser,
  fetchDeploymentsForProject,
  fetchDeploymentLogs,
} from '@/lib/api';

interface LogsPageProps {
  searchParams?: {
    logsDeploymentId?: string;
    logsAutoRefresh?: '0' | '1';
  };
}

export default async function LogsPage({ searchParams }: LogsPageProps) {
  let deploymentOptions: Array<{
    id: string;
    projectId: string;
    projectName: string;
    status: string;
  }> = [];
  let deploymentLogs: Array<{ level: string; message: string; timestamp: string }> = [];
  let selectedProjectId = '';
  let selectedDeploymentId = '';
  let selectedLabel = '';

  const logsAutoRefreshEnabled = searchParams?.logsAutoRefresh === '1';

  if (demoUserId) {
    try {
      const apiProjects = await fetchProjectsForDemoUser();
      const groups = await Promise.all(
        apiProjects.map(async (project) => {
          const items = await fetchDeploymentsForProject(project.id);
          return items.map((d) => ({ deployment: d, project }));
        })
      );

      const sorted = groups
        .flat()
        .sort((a, b) => Date.parse(b.deployment.createdAt) - Date.parse(a.deployment.createdAt));

      deploymentOptions = sorted.slice(0, 25).map(({ deployment, project }) => ({
        id: deployment.id,
        projectId: project.id,
        projectName: project.name,
        status: deployment.status,
      }));

      const selected =
        sorted.find((item) => item.deployment.id === searchParams?.logsDeploymentId) ??
        sorted[0];

      if (selected) {
        selectedProjectId = selected.project.id;
        selectedDeploymentId = selected.deployment.id;
        selectedLabel = `${selected.project.name} / ${selected.deployment.id}`;
        const logs = await fetchDeploymentLogs(
          selected.project.id,
          selected.deployment.id,
          100
        );
        deploymentLogs = logs.map((item) => ({
          level: item.level,
          message: item.message,
          timestamp: item.timestamp,
        }));
      }
    } catch {
      // will show empty state
    }
  }

  const hasLiveData = Boolean(demoUserId && selectedDeploymentId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deployment Logs</h1>
        <p className="text-sm text-muted-foreground">
          View and export logs for any deployment.
        </p>
      </div>

      {hasLiveData ? (
        <>
          <LogsAutoRefresh enabled={logsAutoRefreshEnabled} />

          <form className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <select
              name="logsDeploymentId"
              defaultValue={searchParams?.logsDeploymentId ?? deploymentOptions[0]?.id}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {deploymentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.projectName} / {option.id} ({option.status})
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-xs">
              <input
                type="checkbox"
                name="logsAutoRefresh"
                value="1"
                defaultChecked={logsAutoRefreshEnabled}
              />
              Auto-refresh (5s)
            </label>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Apply
            </button>
          </form>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Showing logs for: <span className="font-medium text-foreground">{selectedLabel}</span>
            </p>
            {selectedProjectId && selectedDeploymentId && (
              <div className="flex gap-2">
                <a
                  href={`/api/log-export?projectId=${encodeURIComponent(selectedProjectId)}&deploymentId=${encodeURIComponent(selectedDeploymentId)}`}
                  className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                >
                  Export NDJSON
                </a>
                <a
                  href={`/api/log-export?projectId=${encodeURIComponent(selectedProjectId)}&deploymentId=${encodeURIComponent(selectedDeploymentId)}&format=ndjson.gz`}
                  className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                >
                  Export GZIP
                </a>
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Log Output</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-72 overflow-auto rounded-md border bg-background p-2 font-mono text-xs">
                {deploymentLogs.length === 0 ? (
                  <p className="text-muted-foreground">
                    No logs found for this deployment yet.
                  </p>
                ) : (
                  deploymentLogs.map((log, index) => (
                    <p
                      key={`${log.timestamp}-${index}`}
                      className="mb-1 whitespace-pre-wrap break-words"
                    >
                      <span className="text-muted-foreground">[{log.timestamp}]</span>{' '}
                      <span className="text-primary">{log.level.toUpperCase()}</span> {log.message}
                    </p>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {selectedProjectId && selectedDeploymentId && (
            <LogsLiveStream
              projectId={selectedProjectId}
              deploymentId={selectedDeploymentId}
              initialLogs={deploymentLogs}
            />
          )}

          <p className="text-xs text-muted-foreground">
            {logsAutoRefreshEnabled
              ? 'Auto-refresh is enabled. Log entries refresh every 5 seconds.'
              : 'Auto-refresh is disabled. Click Apply to refresh or enable auto-refresh.'}
          </p>
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {demoUserId
              ? 'No deployments found. Trigger a deployment first.'
              : 'Log viewer requires a demo user context. Set NEXT_PUBLIC_DEMO_USER_ID.'}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
