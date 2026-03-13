import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { DeploymentTable } from '../components/deployment-table';
import { ConfirmSubmitButton } from '../components/confirm-submit-button';
import { LogsAutoRefresh } from '../components/logs-auto-refresh';
import { LogsLiveStream } from '../components/logs-live-stream';
import { MaskedSecretValue } from '../components/masked-secret-value';
import { PlatformStatusStrip } from '../components/platform-status-strip';
import { ProjectCard } from '../components/project-card';
import { ProjectCreateForm } from '../components/project-create-form';
import { deployments as mockDeployments, projects as mockProjects } from '../lib/mock-data';
import {
  apiBaseUrl,
  createApiToken,
  createDeployment,
  createProject,
  deleteEnvironmentVariable,
  demoUserId,
  fetchApiTokensForUser,
  fetchQueueHealth,
  fetchDeploymentLogs,
  fetchDeploymentsForProject,
  fetchEnvironmentVariables,
  fetchProjectsForDemoUser,
  fetchWorkerHealth,
  revokeApiToken,
  rotateApiToken,
  type ApiProject,
  upsertEnvironmentVariable
} from '../lib/api';

function deriveDomain(project: ApiProject): string {
  return `${project.slug}.apps.platform.example.com`;
}

interface DashboardPageProps {
  searchParams?: {
    deploy?: 'success' | 'error';
    projectCreate?: 'success' | 'error';
    projectCreateReason?: 'slug_taken' | 'invalid_input' | 'api_unavailable';
    env?: 'success' | 'error';
    action?: 'save' | 'delete';
    key?: string;
    project?: string;
    envProjectId?: string;
    logsAutoRefresh?: '0' | '1';
    logsDeploymentId?: string;
    tokenCreate?: 'success' | 'error';
    tokenRevoke?: 'success' | 'error';
    tokenRotate?: 'success' | 'error';
    tokenLabel?: string;
    detailDeploymentId?: string;
  };
}


function slugifyProjectName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}


function extractApiStatusCode(error: unknown): number | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const match = error.message.match(/API_REQUEST_FAILED\s+(\d{3})/);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function createProjectErrorReason(code: number | null): 'slug_taken' | 'api_unavailable' {
  if (code === 409) {
    return 'slug_taken';
  }

  return 'api_unavailable';
}

async function createProjectAction(formData: FormData) {
  'use server';

  if (!demoUserId) {
    redirect('/?projectCreate=error&projectCreateReason=invalid_input');
    return;
  }

  const nameValue = formData.get('name');
  const gitRepositoryUrlValue = formData.get('gitRepositoryUrl');
  const defaultBranchValue = formData.get('defaultBranch');

  if (typeof nameValue !== 'string' || typeof gitRepositoryUrlValue !== 'string') {
    redirect('/?projectCreate=error&projectCreateReason=invalid_input');
    return;
  }

  const name = nameValue.trim();
  const gitRepositoryUrl = gitRepositoryUrlValue.trim();
  const defaultBranch = typeof defaultBranchValue === 'string' ? defaultBranchValue.trim() : '';
  const slug = slugifyProjectName(name);

  if (name.length < 3 || slug.length < 3 || gitRepositoryUrl.length === 0) {
    redirect('/?projectCreate=error&projectCreateReason=invalid_input');
    return;
  }

  try {
    await createProject({
      userId: demoUserId,
      name,
      slug,
      gitRepositoryUrl,
      defaultBranch: defaultBranch.length > 0 ? defaultBranch : undefined
    });

    revalidatePath('/');
    redirect(`/?projectCreate=success&project=${encodeURIComponent(name)}`);
  } catch (error) {
    const statusCode = extractApiStatusCode(error);
    const reason = createProjectErrorReason(statusCode);
    redirect(`/?projectCreate=error&projectCreateReason=${reason}`);
  }
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
    redirect(`/?env=success&action=save&envProjectId=${encodeURIComponent(projectId)}&key=${encodeURIComponent(key)}`);
  } catch {
    redirect(`/?env=error&action=save&envProjectId=${encodeURIComponent(projectId)}`);
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
    redirect(`/?env=success&action=delete&envProjectId=${encodeURIComponent(projectId)}&key=${encodeURIComponent(key)}`);
  } catch {
    redirect(`/?env=error&action=delete&envProjectId=${encodeURIComponent(projectId)}`);
  }
}

async function createApiTokenAction(formData: FormData) {
  'use server';

  if (!demoUserId) {
    redirect('/?tokenCreate=error');
    return;
  }

  const labelValue = formData.get('label');
  const roleValue = formData.get('role');
  const expiresAtValue = formData.get('expiresAt');

  if (typeof roleValue !== 'string' || (roleValue !== 'admin' && roleValue !== 'user')) {
    redirect('/?tokenCreate=error');
    return;
  }

  const label = typeof labelValue === 'string' ? labelValue.trim() : '';
  const expiresAt = typeof expiresAtValue === 'string' ? expiresAtValue.trim() : '';

  try {
    const created = await createApiToken({
      userId: demoUserId,
      role: roleValue,
      label: label.length > 0 ? label : undefined,
      expiresAt: expiresAt.length > 0 ? new Date(expiresAt).toISOString() : undefined
    });

    revalidatePath('/');
    cookies().set('__token_plaintext', created.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 120,
      path: '/',
      sameSite: 'strict'
    });
    redirect(`/?tokenCreate=success&tokenLabel=${encodeURIComponent(created.label ?? 'token')}`);
  } catch {
    redirect('/?tokenCreate=error');
  }
}

async function revokeApiTokenAction(formData: FormData) {
  'use server';

  if (!demoUserId) {
    redirect('/?tokenRevoke=error');
    return;
  }

  const tokenIdValue = formData.get('tokenId');
  if (typeof tokenIdValue !== 'string' || tokenIdValue.length === 0) {
    redirect('/?tokenRevoke=error');
    return;
  }

  try {
    await revokeApiToken(demoUserId, tokenIdValue);
    revalidatePath('/');
    redirect('/?tokenRevoke=success');
  } catch {
    redirect('/?tokenRevoke=error');
  }
}

async function rotateApiTokenAction(formData: FormData) {
  'use server';

  if (!demoUserId) {
    redirect('/?tokenRotate=error');
    return;
  }

  const tokenIdValue = formData.get('tokenId');
  if (typeof tokenIdValue !== 'string' || tokenIdValue.length === 0) {
    redirect('/?tokenRotate=error');
    return;
  }

  try {
    const rotated = await rotateApiToken(demoUserId, tokenIdValue);
    revalidatePath('/');
    cookies().set('__token_plaintext', rotated.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 120,
      path: '/',
      sameSite: 'strict'
    });
    redirect(`/?tokenRotate=success&tokenLabel=${encodeURIComponent(rotated.label ?? 'token')}`);
  } catch {
    redirect('/?tokenRotate=error');
  }
}


export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  let projects = mockProjects;
  let deployments = mockDeployments;
  let environmentVariables: Array<{ key: string; value: string }> = [];
  let envProjectName = '';
  let envProjectId = '';
  let logsDeploymentLabel = '';
  let logsProjectId = '';
  let logsDeploymentId = '';
  let deploymentLogs: Array<{ level: string; message: string; timestamp: string }> = [];
  let usingLiveData = false;
  let liveDataErrorMessage: string | null = null;
  let envProjectOptions: Array<{ id: string; name: string }> = [];
  let logDeploymentOptions: Array<{ id: string; projectName: string; status: string }> = [];
  let apiTokens: Array<{ id: string; label: string | null; role: 'admin' | 'user'; tokenPreview: string; revokedAt: string | null; expiresAt: string | null }> = [];
  let detailDeploymentProjectName = '';
  let detailDeployment: {
    id: string;
    status: string;
    createdAt: string;
    startedAt?: string | null;
    finishedAt?: string | null;
    commitSha?: string | null;
    runtimeUrl?: string | null;
  } | null = null;
  let detailDeploymentLogs: Array<{ level: string; message: string; timestamp: string }> = [];
  let detailDeploymentOptions: Array<{ id: string; projectName: string; status: string }> = [];

  let platformApiStatus: 'ok' | 'degraded' | 'unavailable' = 'degraded';
  let platformQueueStatus: 'ok' | 'degraded' | 'unavailable' = 'unavailable';
  let platformWorkerStatus: 'ok' | 'stale' | 'unavailable' = 'unavailable';
  let platformQueueCounts = { waiting: 0, active: 0, completed: 0, failed: 0 };
  let platformWorkerAgeMs: number | undefined;
  let lastSuccessfulDeployAt: string | undefined;

  const logsAutoRefreshEnabled = searchParams?.logsAutoRefresh === '1';

  const tokenCookie = cookies().get('__token_plaintext');
  const tokenPlaintextFromCookie = tokenCookie?.value ?? null;
  if (tokenCookie) {
    cookies().delete('__token_plaintext');
  }

  if (demoUserId) {
    try {
      const apiProjects = await fetchProjectsForDemoUser();
      const deploymentGroups = await Promise.all(
        apiProjects.map(async (project) => {
          const items = await fetchDeploymentsForProject(project.id);
          return items.map((deployment) => ({ deployment, project }));
        })
      );

      const sortedDeployments = deploymentGroups
        .flat()
        .sort((a, b) => Date.parse(b.deployment.createdAt) - Date.parse(a.deployment.createdAt));

      const mappedProjects = apiProjects.map((project) => ({
        id: project.id,
        name: project.name,
        repo: project.gitRepositoryUrl,
        domain: deriveDomain(project),
        status: 'active'
      }));

      const mappedDeployments = sortedDeployments.slice(0, 10).map(({ deployment, project }) => ({
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

      const queueHealth = await fetchQueueHealth();
      const workerHealth = await fetchWorkerHealth();
      platformApiStatus = queueHealth.status === 'unavailable' && workerHealth.status === 'unavailable' ? 'degraded' : 'ok';
      platformQueueStatus = queueHealth.status;
      platformWorkerStatus = workerHealth.status;
      platformWorkerAgeMs = workerHealth.ageMs;
      if (queueHealth.counts) {
        platformQueueCounts = {
          waiting: queueHealth.counts.waiting,
          active: queueHealth.counts.active,
          completed: queueHealth.counts.completed,
          failed: queueHealth.counts.failed
        };
      }

      const lastSuccessful = sortedDeployments.find((item) => item.deployment.status === 'running');
      if (lastSuccessful) {
        lastSuccessfulDeployAt = lastSuccessful.deployment.createdAt;
      }

      envProjectOptions = apiProjects.map((project) => ({ id: project.id, name: project.name }));

      const selectedEnvProject =
        apiProjects.find((project) => project.id === searchParams?.envProjectId) ?? apiProjects[0];

      if (selectedEnvProject) {
        envProjectName = selectedEnvProject.name;
        envProjectId = selectedEnvProject.id;
        const envItems = await fetchEnvironmentVariables(selectedEnvProject.id);
        environmentVariables = envItems.map((item) => ({ key: item.key, value: item.value }));
      }

      const fetchedTokens = await fetchApiTokensForUser(demoUserId);
      apiTokens = fetchedTokens.map((token) => ({
        id: token.id,
        label: token.label,
        role: token.role,
        tokenPreview: token.tokenPreview,
        revokedAt: token.revokedAt,
        expiresAt: token.expiresAt
      }));

      logDeploymentOptions = sortedDeployments.slice(0, 25).map(({ deployment, project }) => ({
        id: deployment.id,
        projectName: project.name,
        status: deployment.status
      }));

      detailDeploymentOptions = logDeploymentOptions;

      const selectedDetailDeployment =
        sortedDeployments.find((item) => item.deployment.id === searchParams?.detailDeploymentId) ?? sortedDeployments[0];

      if (selectedDetailDeployment) {
        detailDeploymentProjectName = selectedDetailDeployment.project.name;
        detailDeployment = {
          id: selectedDetailDeployment.deployment.id,
          status: selectedDetailDeployment.deployment.status,
          createdAt: selectedDetailDeployment.deployment.createdAt,
          startedAt: selectedDetailDeployment.deployment.startedAt ?? null,
          finishedAt: selectedDetailDeployment.deployment.finishedAt ?? null,
          commitSha: selectedDetailDeployment.deployment.commitSha,
          runtimeUrl: selectedDetailDeployment.deployment.runtimeUrl ?? null
        };
        const detailLogs = await fetchDeploymentLogs(
          selectedDetailDeployment.project.id,
          selectedDetailDeployment.deployment.id,
          20
        );
        detailDeploymentLogs = detailLogs.map((item) => ({
          level: item.level,
          message: item.message,
          timestamp: item.timestamp
        }));
      }

      const selectedDeployment =
        sortedDeployments.find((item) => item.deployment.id === searchParams?.logsDeploymentId) ?? sortedDeployments[0];

      if (selectedDeployment) {
        logsProjectId = selectedDeployment.project.id;
        logsDeploymentId = selectedDeployment.deployment.id;
        logsDeploymentLabel = `${selectedDeployment.project.name} / ${selectedDeployment.deployment.id}`;
        const logs = await fetchDeploymentLogs(
          selectedDeployment.project.id,
          selectedDeployment.deployment.id,
          100
        );
        deploymentLogs = logs.map((item) => ({
          level: item.level,
          message: item.message,
          timestamp: item.timestamp
        }));
      }

      usingLiveData = true;
    } catch (error) {
      usingLiveData = false;
      liveDataErrorMessage = error instanceof Error ? error.message : 'Failed to fetch live API data.';
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
          API target: <span className="font-mono">{apiBaseUrl}</span>
        </p>
        <p>
          Demo user ID: <span className="font-mono">{demoUserId ?? 'not configured'}</span>
        </p>
        {!usingLiveData && (
          <div className="mt-2 rounded border border-amber-700/70 bg-amber-950/30 p-2 text-amber-200">
            <p>Live API unavailable. Showing mock projects/deployments only.</p>
            {liveDataErrorMessage ? <p className="mt-1 font-mono text-[11px] text-amber-300/90">{liveDataErrorMessage}</p> : null}
          </div>
        )}
        {searchParams?.deploy === 'success' && (
          <p className="mt-2 text-emerald-300">
            Deployment triggered successfully{searchParams.project ? ` for ${decodeURIComponent(searchParams.project)}` : ''}.
          </p>
        )}
        {searchParams?.deploy === 'error' && (
          <p className="mt-2 text-rose-300">Failed to trigger deployment. Verify API connectivity and project data.</p>
        )}
        {searchParams?.projectCreate === 'success' && (
          <p className="mt-2 text-emerald-300">
            Project created successfully{searchParams.project ? `: ${decodeURIComponent(searchParams.project)}` : ''}.
          </p>
        )}
        {searchParams?.projectCreate === 'error' && (
          <p className="mt-2 text-rose-300">
            {searchParams.projectCreateReason === 'slug_taken'
              ? 'Project name creates a slug that already exists. Try a more specific project name.'
              : searchParams.projectCreateReason === 'invalid_input'
                ? 'Invalid project input. Ensure name/repository URL are valid and try again.'
                : 'Failed to create project. Check API availability and try again.'}
          </p>
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
        {searchParams?.tokenCreate === 'success' && (
          <p className="mt-2 text-emerald-300">
            API token created successfully{searchParams.tokenLabel ? `: ${decodeURIComponent(searchParams.tokenLabel)}` : ''}.
            Copy it now if shown in the list details.
          </p>
        )}
        {searchParams?.tokenRotate === 'success' && (
          <p className="mt-2 text-emerald-300">
            API token rotated successfully{searchParams.tokenLabel ? `: ${decodeURIComponent(searchParams.tokenLabel)}` : ''}.
          </p>
        )}
        {searchParams?.tokenCreate === 'error' && (
          <p className="mt-2 text-rose-300">Failed to create API token. Verify auth context and input values.</p>
        )}
        {searchParams?.tokenRevoke === 'success' && (
          <p className="mt-2 text-emerald-300">API token revoked successfully.</p>
        )}
        {searchParams?.tokenRevoke === 'error' && (
          <p className="mt-2 text-rose-300">Failed to revoke API token.</p>
        )}
        {searchParams?.tokenRotate === 'error' && (
          <p className="mt-2 text-rose-300">Failed to rotate API token.</p>
        )}
        {tokenPlaintextFromCookie && (
          <div className="mt-2 rounded border border-amber-700/80 bg-amber-950/40 p-3">
            <p className="text-xs text-amber-200">Copy this token now. It will not be shown again.</p>
            <code className="mt-1 block break-all font-mono text-xs text-amber-100">
              {tokenPlaintextFromCookie}
            </code>
          </div>
        )}
      </section>

      <PlatformStatusStrip
        apiStatus={platformApiStatus}
        queueStatus={platformQueueStatus}
        workerStatus={platformWorkerStatus}
        queueCounts={platformQueueCounts}
        workerAgeMs={platformWorkerAgeMs}
        lastSuccessfulDeployAt={lastSuccessfulDeployAt}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects</h2>
        </div>
        {usingLiveData ? <ProjectCreateForm action={createProjectAction} /> : null}
        {projects.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
            No projects yet. Create your first project to start deployments.
          </div>
        ) : (
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
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent Deployments</h2>
        {deployments.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
            No deployments yet. Trigger a deployment from a project card.
          </div>
        ) : (
          <DeploymentTable deployments={deployments} />
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 text-lg font-semibold">Deployment Detail</h2>
        {usingLiveData && detailDeployment ? (
          <>
            <form className="mb-3 grid gap-2 md:grid-cols-[1fr_auto]">
              <select
                name="detailDeploymentId"
                defaultValue={searchParams?.detailDeploymentId ?? detailDeploymentOptions[0]?.id}
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                {detailDeploymentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.projectName} / {option.id} ({option.status})
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded bg-cyan-700 px-3 py-2 text-sm font-medium hover:bg-cyan-600">
                Load Deployment
              </button>
            </form>

            <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
              <aside className="rounded border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-wide text-slate-500">Deployment ID</p>
                <p className="mb-2 break-all font-mono text-xs">{detailDeployment.id}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">Project</p>
                <p className="mb-2">{detailDeploymentProjectName}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                <p className="mb-2">{detailDeployment.status}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">Commit</p>
                <p className="mb-2 font-mono text-xs">{detailDeployment.commitSha ?? 'unknown'}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">Runtime URL</p>
                <p className="mb-2 break-all text-xs text-cyan-300">{detailDeployment.runtimeUrl ?? 'pending'}</p>
              </aside>

              <div className="rounded border border-slate-800 bg-slate-950 p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-200">Timeline and Diagnostics</h3>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="rounded border border-slate-800 bg-slate-900 px-2 py-2">
                    <span className="text-cyan-300">Created:</span> {new Date(detailDeployment.createdAt).toLocaleString()}
                  </li>
                  <li className="rounded border border-slate-800 bg-slate-900 px-2 py-2">
                    <span className="text-cyan-300">Started:</span>{' '}
                    {detailDeployment.startedAt ? new Date(detailDeployment.startedAt).toLocaleString() : 'not started'}
                  </li>
                  <li className="rounded border border-slate-800 bg-slate-900 px-2 py-2">
                    <span className="text-cyan-300">Finished:</span>{' '}
                    {detailDeployment.finishedAt ? new Date(detailDeployment.finishedAt).toLocaleString() : 'in progress'}
                  </li>
                </ul>

                <div className="mt-3 max-h-60 overflow-auto rounded border border-slate-800 bg-slate-900 p-2 font-mono text-xs">
                  {detailDeploymentLogs.length === 0 ? (
                    <p className="text-slate-500">No diagnostic logs captured for this deployment yet.</p>
                  ) : (
                    detailDeploymentLogs.map((log, index) => (
                      <p key={`${log.timestamp}-${index}`} className="mb-1 whitespace-pre-wrap break-words text-slate-300">
                        <span className="text-slate-500">[{log.timestamp}]</span>{' '}
                        <span className="text-cyan-300">{log.level.toUpperCase()}</span> {log.message}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">Deployment detail needs live API mode and at least one deployment.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 text-lg font-semibold">API Tokens</h2>
        {usingLiveData && demoUserId ? (
          <>
            <form action={createApiTokenAction} className="mb-4 grid gap-2 md:grid-cols-[1fr_140px_180px_auto]">
              <input
                type="text"
                name="label"
                placeholder="Label (optional)"
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
              <select
                name="role"
                defaultValue="user"
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
              <input
                type="datetime-local"
                name="expiresAt"
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500">
                Create Token
              </button>
            </form>
            <div className="space-y-2">
              {apiTokens.length === 0 ? (
                <p className="text-sm text-slate-400">No API tokens yet.</p>
              ) : (
                apiTokens.map((token) => (
                  <div key={token.id} className="flex items-center justify-between rounded border border-slate-800 px-3 py-2">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-200">
                        {token.label ?? 'unlabeled token'} <span className="text-xs text-cyan-300">({token.role})</span>
                      </p>
                      <p className="font-mono text-xs text-slate-400">{token.tokenPreview}</p>
                      <p className="text-xs text-slate-500">
                        {token.revokedAt
                          ? `Revoked at ${token.revokedAt}`
                          : token.expiresAt
                            ? `Expires at ${token.expiresAt}`
                            : 'No expiration'}
                      </p>
                    </div>
                    {token.revokedAt ? (
                      <span className="text-xs text-rose-300">Revoked</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <form action={rotateApiTokenAction}>
                          <input type="hidden" name="tokenId" value={token.id} readOnly />
                          <ConfirmSubmitButton
                            label="Rotate"
                            confirmMessage="Rotate this API token now? The current token will stop working immediately."
                            className="rounded border border-amber-700 px-2 py-1 text-xs text-amber-300 hover:bg-amber-900/30"
                          />
                        </form>
                        <form action={revokeApiTokenAction}>
                          <input type="hidden" name="tokenId" value={token.id} readOnly />
                          <ConfirmSubmitButton
                            label="Revoke"
                            confirmMessage="Revoke this API token? Any clients using it will lose access immediately."
                            className="rounded border border-rose-700 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/30"
                          />
                        </form>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">Token management needs live API mode and a demo user context.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 text-lg font-semibold">Environment Variables</h2>
        {usingLiveData && envProjectId ? (
          <>
            <form className="mb-3 grid gap-2 md:grid-cols-[1fr_auto]">
              <select
                name="envProjectId"
                defaultValue={envProjectId}
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                {envProjectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded bg-cyan-700 px-3 py-2 text-sm font-medium hover:bg-cyan-600">
                Select Project
              </button>
            </form>
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
                      <MaskedSecretValue value={item.value} />
                    </div>
                    <form action={removeEnvironmentVariable}>
                      <input type="hidden" name="projectId" value={envProjectId} readOnly />
                      <input type="hidden" name="key" value={item.key} readOnly />
                      <ConfirmSubmitButton
                        label="Delete"
                        confirmMessage={`Delete environment variable ${item.key}? This may break the running app until next deploy.`}
                        className="rounded border border-rose-700 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/30"
                      />
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
            <LogsAutoRefresh enabled={logsAutoRefreshEnabled} />
            <form className="mb-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
              <select
                name="logsDeploymentId"
                defaultValue={searchParams?.logsDeploymentId ?? logDeploymentOptions[0]?.id}
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                {logDeploymentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.projectName} / {option.id} ({option.status})
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 rounded border border-slate-700 px-3 py-2 text-xs text-slate-300">
                <input type="checkbox" name="logsAutoRefresh" value="1" defaultChecked={logsAutoRefreshEnabled} />
                Auto-refresh (5s)
              </label>
              <button type="submit" className="rounded bg-cyan-700 px-3 py-2 text-sm font-medium hover:bg-cyan-600">
                Apply
              </button>
            </form>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-400">Showing deployment logs for: {logsDeploymentLabel}</p>
              {logsProjectId && logsDeploymentId ? (
                <div className="flex gap-2">
                  <a
                    href={`/api/log-export?projectId=${encodeURIComponent(logsProjectId)}&deploymentId=${encodeURIComponent(logsDeploymentId)}`}
                    className="rounded border border-cyan-700 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-900/30"
                  >
                    Export NDJSON
                  </a>
                  <a
                    href={`/api/log-export?projectId=${encodeURIComponent(logsProjectId)}&deploymentId=${encodeURIComponent(logsDeploymentId)}&format=ndjson.gz`}
                    className="rounded border border-cyan-700 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-900/30"
                  >
                    Export GZIP
                  </a>
                </div>
              ) : null}
            </div>
            <div className="max-h-72 overflow-auto rounded border border-slate-800 bg-slate-950 p-2 font-mono text-xs">
              {deploymentLogs.length === 0 ? (
                <p className="text-slate-500">No logs found for this deployment yet.</p>
              ) : (
                deploymentLogs.map((log, index) => (
                  <p key={`${log.timestamp}-${index}`} className="mb-1 whitespace-pre-wrap break-words text-slate-300">
                    <span className="text-slate-500">[{log.timestamp}]</span>{' '}
                    <span className="text-cyan-300">{log.level.toUpperCase()}</span> {log.message}
                  </p>
                ))
              )}
            </div>
            {logsProjectId && logsDeploymentId ? (
              <LogsLiveStream
                projectId={logsProjectId}
                deploymentId={logsDeploymentId}
                initialLogs={deploymentLogs}
              />
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              {logsAutoRefreshEnabled
                ? 'Auto-refresh is enabled. Log entries refresh every 5 seconds.'
                : 'Auto-refresh is disabled. Click Apply to refresh logs or enable auto-refresh.'}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400">Logs viewer needs live API mode and at least one deployment.</p>
        )}
      </section>
    </main>
  );
}
