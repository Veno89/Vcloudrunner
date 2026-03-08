import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { DeploymentTable } from '../components/deployment-table.js';
import { ProjectCard } from '../components/project-card.js';
import { deployments as mockDeployments, projects as mockProjects } from '../lib/mock-data.js';
import {
  apiBaseUrl,
  createDeployment,
  deleteEnvironmentVariable,
  demoUserId,
  fetchDeploymentLogs,
  fetchDeploymentsForProject,
  fetchEnvironmentVariables,
  fetchProjectsForDemoUser,
  type ApiProject,
  upsertEnvironmentVariable
} from '../lib/api.js';

function deriveDomain(project: ApiProject): string {
  return `${project.slug}.apps.platform.example.com`;
}

interface DashboardPageProps {
  searchParams?: {
    deploy?: 'success' | 'error';
    env?: 'success' | 'error';
    action?: 'save' | 'delete';
    key?: string;
    project?: string;
  };
}

async function triggerDeployment(formData: FormData) {
  'use server';

  const projectIdValue = formData.get('projectId');
  const projectNameValue = formData.get('projectName');

  if (typeof projectIdValue !== 'string' || projectIdValue.length === 0) {
    redirect('/?deploy=error');
    return;
  }

  const projectId = projectIdValue;
  const projectName = typeof projectNameValue === 'string' ? projectNameValue : '';

  try {
    await createDeployment(projectId);
    revalidatePath('/');
    const label = encodeURIComponent(projectName);
    redirect(`/?deploy=success&project=${label}`);
  } catch {
    redirect('/?deploy=error');
  }
}

async function saveEnvironmentVariable(formData: FormData) {
  'use server';

  const projectIdValue = formData.get('projectId');
  const keyValue = formData.get('key');
  const valueValue = formData.get('value');

  if (typeof projectIdValue !== 'string' || typeof keyValue !== 'string' || typeof valueValue !== 'string') {
    redirect('/?env=error&action=save');
    return;
  }

  const projectId = projectIdValue;
  const key = keyValue;
  const value = valueValue;

  try {
    await upsertEnvironmentVariable(projectId, key, value);
    revalidatePath('/');
    redirect(`/?env=success&action=save&key=${encodeURIComponent(key)}`);
  } catch {
    redirect('/?env=error&action=save');
  }
}

async function removeEnvironmentVariable(formData: FormData) {
  'use server';

  const projectIdValue = formData.get('projectId');
  const keyValue = formData.get('key');

  if (typeof projectIdValue !== 'string' || typeof keyValue !== 'string') {
    redirect('/?env=error&action=delete');
    return;
  }

  const projectId = projectIdValue;
  const key = keyValue;

  try {
    await deleteEnvironmentVariable(projectId, key);
    revalidatePath('/');
    redirect(`/?env=success&action=delete&key=${encodeURIComponent(key)}`);
  } catch {
    redirect('/?env=error&action=delete');
  }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  let projects = mockProjects;
  let deployments = mockDeployments;
  let environmentVariables: Array<{ key: string; value: string }> = [];
  let envProjectName = '';
  let envProjectId = '';
  let logsDeploymentLabel = '';
  let deploymentLogs: Array<{ level: string; message: string; timestamp: string }> = [];
  let usingLiveData = false;

  if (demoUserId) {
    try {
      const apiProjects = await fetchProjectsForDemoUser();
      const deploymentGroups = await Promise.all(
        apiProjects.map(async (project) => {
          const items = await fetchDeploymentsForProject(project.id);
          return items.map((deployment) => ({ deployment, project }));
        })
      );

      const mappedProjects = apiProjects.map((project) => ({
        id: project.id,
        name: project.name,
        repo: project.gitRepositoryUrl,
        domain: deriveDomain(project),
        status: 'active'
      }));

      const mappedDeployments = deploymentGroups
        .flat()
        .sort((a, b) => Date.parse(b.deployment.createdAt) - Date.parse(a.deployment.createdAt))
        .slice(0, 10)
        .map(({ deployment, project }) => ({
          id: deployment.id,
          project: project.name,
          status: deployment.status,
          commitSha: deployment.commitSha ?? 'unknown',
          createdAt: new Date(deployment.createdAt).toISOString()
        }));

      if (mappedProjects.length > 0) {
        projects = mappedProjects;
      }
      if (mappedDeployments.length > 0) {
        deployments = mappedDeployments;
      }

      const envProject = apiProjects[0];
      if (envProject) {
        envProjectName = envProject.name;
        envProjectId = envProject.id;
        const envItems = await fetchEnvironmentVariables(envProject.id);
        environmentVariables = envItems.map((item) => ({ key: item.key, value: item.value }));
      }

      const latestDeployment = deploymentGroups
        .flat()
        .sort((a, b) => Date.parse(b.deployment.createdAt) - Date.parse(a.deployment.createdAt))[0];

      if (latestDeployment) {
        logsDeploymentLabel = `${latestDeployment.project.name} / ${latestDeployment.deployment.id}`;
        const logs = await fetchDeploymentLogs(
          latestDeployment.project.id,
          latestDeployment.deployment.id,
          100
        );
        deploymentLogs = logs.map((item) => ({
          level: item.level,
          message: item.message,
          timestamp: item.timestamp
        }));
      }

      usingLiveData = true;
    } catch {
      usingLiveData = false;
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Vcloudrunner Dashboard</h1>
        <p className="text-sm text-slate-400">Manage projects, trigger deployments, and inspect logs.</p>
      </header>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300">
        <p>
          Data source:{' '}
          <span className="font-semibold text-cyan-300">
            {usingLiveData ? `Live API (${apiBaseUrl})` : 'Mock fallback'}
          </span>
        </p>
        {!demoUserId && (
          <p className="mt-1 text-slate-400">
            Set <code>NEXT_PUBLIC_DEMO_USER_ID</code> to enable API-backed data.
          </p>
        )}
        {searchParams?.deploy === 'success' && (
          <p className="mt-2 text-emerald-300">
            Deployment triggered successfully{searchParams.project ? ` for ${decodeURIComponent(searchParams.project)}` : ''}.
          </p>
        )}
        {searchParams?.deploy === 'error' && (
          <p className="mt-2 text-rose-300">Failed to trigger deployment. Verify API connectivity and project data.</p>
        )}
        {searchParams?.env === 'success' && (
          <p className="mt-2 text-emerald-300">
            Environment variable {searchParams.action === 'delete' ? 'deleted' : 'saved'}
            {searchParams.key ? `: ${decodeURIComponent(searchParams.key)}` : ''}.
          </p>
        )}
        {searchParams?.env === 'error' && (
          <p className="mt-2 text-rose-300">
            Failed to {searchParams.action === 'delete' ? 'delete' : 'save'} environment variable.
          </p>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects</h2>
          <button className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium hover:bg-emerald-500">
            New Project
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => (
            <div key={project.id} className="space-y-2">
              <ProjectCard
                name={project.name}
                repo={project.repo}
                domain={project.domain}
                status={project.status}
                buttonLabel={usingLiveData ? 'Deploy now' : 'Deploy (mock mode)'}
              />
              {usingLiveData ? (
                <form action={triggerDeployment}>
                  <input name="projectId" value={project.id} type="hidden" readOnly />
                  <input name="projectName" value={project.name} type="hidden" readOnly />
                  <button
                    type="submit"
                    className="w-full rounded border border-cyan-700 bg-cyan-900/40 px-3 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-800/40"
                  >
                    Trigger Deployment Job
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent Deployments</h2>
        <DeploymentTable deployments={deployments} />
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 text-lg font-semibold">Environment Variables</h2>
        {usingLiveData && envProjectId ? (
          <>
            <p className="mb-3 text-xs text-slate-400">Editing project: {envProjectName}</p>

            <form action={saveEnvironmentVariable} className="mb-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <input type="hidden" name="projectId" value={envProjectId} readOnly />
              <input
                type="text"
                name="key"
                placeholder="KEY_NAME"
                required
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
              <input
                type="text"
                name="value"
                placeholder="value"
                required
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500">
                Save
              </button>
            </form>

            <div className="space-y-2">
              {environmentVariables.length === 0 ? (
                <p className="text-sm text-slate-400">No variables set yet.</p>
              ) : (
                environmentVariables.map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded border border-slate-800 px-3 py-2">
                    <div>
                      <p className="font-mono text-sm text-cyan-300">{item.key}</p>
                      <p className="text-xs text-slate-400">{item.value}</p>
                    </div>
                    <form action={removeEnvironmentVariable}>
                      <input type="hidden" name="projectId" value={envProjectId} readOnly />
                      <input type="hidden" name="key" value={item.key} readOnly />
                      <button type="submit" className="rounded border border-rose-700 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/30">
                        Delete
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">Environment editor needs live API mode and a demo user context.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 text-lg font-semibold">Deployment Logs</h2>
        {usingLiveData && logsDeploymentLabel ? (
          <>
            <p className="mb-3 text-xs text-slate-400">Showing latest deployment logs for: {logsDeploymentLabel}</p>
            <div className="max-h-72 overflow-auto rounded border border-slate-800 bg-slate-950 p-2 font-mono text-xs">
              {deploymentLogs.length === 0 ? (
                <p className="text-slate-500">No logs found for this deployment yet.</p>
              ) : (
                deploymentLogs.map((log, index) => (
                  <p key={`${log.timestamp}-${index}`} className="mb-1 whitespace-pre-wrap break-words text-slate-300">
                    <span className="text-slate-500">[{log.timestamp}]</span>{' '}
                    <span className="text-cyan-300">{log.level.toUpperCase()}</span>{' '}
                    {log.message}
                  </p>
                ))
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">Refresh the page to fetch the latest log entries.</p>
          </>
        ) : (
          <p className="text-sm text-slate-400">Logs viewer needs live API mode and at least one deployment.</p>
        )}
      </section>
    </main>
  );
}
