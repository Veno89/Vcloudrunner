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
import { ProjectsOnboardingClient } from '@/components/onboarding/projects-onboarding-client';
import { loadDashboardData } from '@/lib/loaders';

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

  return (
    <PageLayout>
      <PageHeader
        title="Projects"
        description="Manage your projects, service layouts, and deployments."
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

      {data.usingLiveData && (
        <ProjectCreatePanel
          action={createProjectAction}
          defaultOpen={projects.length === 0 || searchParams?.status === 'error'}
        />
      )}

      {data.authRequirement ? null : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start deployments."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => (
            <div key={project.id} className="space-y-2">
              <ProjectCard
                name={project.name}
                repo={project.repo}
                domain={project.domain}
                routeStatusSummary={project.routeStatusSummary}
                serviceSummary={project.serviceSummary}
                serviceStatusSummary={project.serviceStatusSummary}
                status={project.status}
                statusVariant={project.statusVariant}
              />
              {data.usingLiveData && (
                <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                  <Link href={`/projects/${project.id}`}>Open Project</Link>
                </Button>
              )}
              {data.usingLiveData && (
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
              )}
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
