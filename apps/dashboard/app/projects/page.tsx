import { ProjectCard } from '@/components/project-card';
import { ProjectCreatePanel } from '@/components/project-create-panel';
import { ActionToast } from '@/components/action-toast';
import { DashboardAuthRequiredState } from '@/components/dashboard-auth-required-state';
import { EmptyState } from '@/components/empty-state';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { FormSubmitButton } from '@/components/form-submit-button';
import { PageHeader } from '@/components/page-header';
import { PageLayout } from '@/components/page-layout';
import { ProjectWorkspaceOverview } from '@/components/project-workspace-overview';
import { ProjectsOnboardingClient } from '@/components/onboarding/projects-onboarding-client';
import { loadDashboardData } from '@/lib/loaders';
import { fetchGitHubInstallations, fetchGitHubInstallUrl, fetchGitHubStatus } from '@/lib/api';

import { createProjectAction, triggerDeploymentAction } from './actions';

interface ProjectsPageProps {
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
    reason?: string;
  };
}

const PROJECT_CREATE_ERROR_MESSAGES: Record<string, string> = {
  slug_taken: 'Project name creates a slug that already exists. Try a more specific name.',
  invalid_input: 'Invalid project input. Ensure the project name, repository URL, and branch are all valid.',
  auth_required: 'Project creation is unauthorized. Sign in again with an active dashboard session, use API_AUTH_TOKEN only as a temporary fallback, or use the explicit local dev-auth bypass.',
  access_denied: 'Project creation is authenticated but lacks the required project write access.',
  user_context_missing: 'Project creation requires a live dashboard session. Sign in with a valid token, use API_AUTH_TOKEN only as a temporary fallback, or use explicit local dev-auth setup.',
  api_unavailable: 'Project creation is temporarily unavailable. Check API availability and retry.'
};

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const data = await loadDashboardData();
  const projects = data.projects;
  const healthyProjects = projects.filter((project) => project.statusVariant === 'success').length;
  const deployingProjects = projects.filter((project) => project.status === 'deploying').length;
  const attentionProjects = projects.filter((project) => (
    project.statusVariant === 'warning' || project.statusVariant === 'destructive'
  )).length;
  const createErrorReason =
    searchParams?.status === 'error' && searchParams?.reason && searchParams.reason in PROJECT_CREATE_ERROR_MESSAGES
      ? searchParams.reason
      : null;
  const createErrorMessage = createErrorReason ? PROJECT_CREATE_ERROR_MESSAGES[createErrorReason] : null;
  const shouldReopenCreateProject = projects.length === 0 || Boolean(createErrorReason);
  const actionToastMessage = createErrorMessage ?? searchParams?.message;

  let githubInstallations: Awaited<ReturnType<typeof fetchGitHubInstallations>> = [];
  let githubInstallUrl: string | null = null;

  if (data.usingLiveData) {
    try {
      const status = await fetchGitHubStatus();
      if (status.configured) {
        const [installs, urlResult] = await Promise.all([
          fetchGitHubInstallations().catch(() => []),
          fetchGitHubInstallUrl().catch(() => null)
        ]);
        githubInstallations = installs;
        githubInstallUrl = urlResult;
      }
    } catch {
      // GitHub App not configured; fall back to manual URL entry.
    }
  }

  return (
    <PageLayout>
      <PageHeader
        title="Projects"
        description="Create, deploy, and check the health of every app from one workspace."
      />

      <ActionToast
        status={searchParams?.status}
        message={actionToastMessage ? encodeURIComponent(actionToastMessage) : undefined}
        fallbackErrorMessage="Operation failed. Check API availability and try again."
      />

      {!data.usingLiveData && data.authRequirement ? (
        <DashboardAuthRequiredState
          requirement={data.authRequirement}
          redirectTo="/projects"
        />
      ) : null}

      {!data.usingLiveData && !data.authRequirement ? (
        <DemoModeBanner detail={data.liveDataErrorMessage}>
          Live project data unavailable, showing sample project data.
        </DemoModeBanner>
      ) : null}

      {data.usingLiveData && data.liveDataErrorMessage && (
        <DemoModeBanner title="Partial outage" detail={data.liveDataErrorMessage}>
          Live project data is available, but some deployment history is temporarily unavailable.
        </DemoModeBanner>
      )}

      {data.usingLiveData && (
        <ProjectsOnboardingClient hasProjects={projects.length > 0} />
      )}

      {data.authRequirement ? null : (
        <ProjectWorkspaceOverview
          projectCount={projects.length}
          healthyCount={healthyProjects}
          deployingCount={deployingProjects}
          attentionCount={attentionProjects}
          usingLiveData={data.usingLiveData}
        />
      )}

      {data.usingLiveData && (
        <ProjectCreatePanel
          action={createProjectAction}
          defaultOpen={shouldReopenCreateProject}
          githubInstallations={githubInstallations}
          githubInstallUrl={githubInstallUrl}
          projectCount={projects.length}
          submissionError={createErrorMessage}
          submissionReason={createErrorReason}
        />
      )}

      {data.authRequirement ? null : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project above to connect a repository and start shipping from this workspace."
        />
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">Your projects</h2>
            <p className="text-sm text-muted-foreground">
              Open a project for deeper configuration, or trigger a fresh deployment directly from the card.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                href={data.usingLiveData ? `/projects/${project.id}` : undefined}
                name={project.name}
                repo={project.repo}
                domain={project.domain}
                routeStatusSummary={project.routeStatusSummary}
                serviceSummary={project.serviceSummary}
                serviceStatusSummary={project.serviceStatusSummary}
                status={project.status}
                statusVariant={project.statusVariant}
                actions={data.usingLiveData ? (
                  <form action={triggerDeploymentAction}>
                    <input name="projectId" value={project.id} type="hidden" readOnly />
                    <input name="projectName" value={project.name} type="hidden" readOnly />
                    <FormSubmitButton
                      idleText="Deploy"
                      pendingText="Deploying..."
                      variant="outline"
                      size="sm"
                      className="w-full"
                    />
                  </form>
                ) : null}
              />
            ))}
          </div>
        </section>
      )}
    </PageLayout>
  );
}
