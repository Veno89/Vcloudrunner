import { ProjectCard } from '@/components/project-card';
import { ProjectCreatePanel } from '@/components/project-create-panel';
import { Button } from '@/components/ui/button';
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

import Link from 'next/link';
import { createProjectAction, triggerDeploymentAction } from './actions';

interface ProjectsPageProps {
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
    reason?: string;
  };
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const data = await loadDashboardData();
  const projects = data.projects;
  const healthyProjects = projects.filter((project) => project.statusVariant === 'success').length;
  const deployingProjects = projects.filter((project) => project.status === 'deploying').length;
  const attentionProjects = projects.filter((project) => (
    project.statusVariant === 'warning' || project.statusVariant === 'destructive'
  )).length;

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
      // GitHub App not configured — fall back to manual URL entry
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
        message={
          searchParams?.reason === 'slug_taken'
            ? encodeURIComponent('Project name creates a slug that already exists. Try a more specific name.')
            : searchParams?.reason === 'invalid_input'
              ? encodeURIComponent('Invalid project input. Ensure name/repository URL are valid.')
              : searchParams?.reason === 'auth_required'
                ? encodeURIComponent('Project creation is unauthorized. Sign in again with an active dashboard session, use API_AUTH_TOKEN only as a temporary fallback, or use the explicit local dev-auth bypass.')
              : searchParams?.reason === 'access_denied'
                  ? encodeURIComponent('Project creation is authenticated but lacks the required project write access.')
                  : searchParams?.reason === 'user_context_missing'
                    ? encodeURIComponent('Project creation requires a live dashboard session. Sign in with a valid token, use API_AUTH_TOKEN only as a temporary fallback, or use explicit local dev-auth setup.')
              : searchParams?.message
        }
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
          defaultOpen={projects.length === 0 || searchParams?.status === 'error'}
          githubInstallations={githubInstallations}
          githubInstallUrl={githubInstallUrl}
          projectCount={projects.length}
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
                name={project.name}
                repo={project.repo}
                domain={project.domain}
                routeStatusSummary={project.routeStatusSummary}
                serviceSummary={project.serviceSummary}
                serviceStatusSummary={project.serviceStatusSummary}
                status={project.status}
                statusVariant={project.statusVariant}
                actions={data.usingLiveData ? (
                  <>
                    <Button asChild variant="ghost" size="sm" className="w-full justify-center sm:justify-start">
                      <Link href={`/projects/${project.id}`}>Open Project</Link>
                    </Button>
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
                  </>
                ) : null}
              />
            ))}
          </div>
        </section>
      )}
    </PageLayout>
  );
}
