import { ProjectCard } from '@/components/project-card';
import { ProjectCreatePanel } from '@/components/project-create-panel';
import { Button } from '@/components/ui/button';
import { ActionToast } from '@/components/action-toast';
import { EmptyState } from '@/components/empty-state';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { FormSubmitButton } from '@/components/form-submit-button';
import { PageHeader } from '@/components/page-header';
import { PageLayout } from '@/components/page-layout';
import { loadDashboardData } from '@/lib/loaders';
import { projects as mockProjects } from '@/lib/mock-data';
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
  const projects = data.usingLiveData ? data.projects : mockProjects;

  return (
    <PageLayout>
      <PageHeader
        title="Projects"
        description="Manage your projects and trigger deployments."
      />

      <ActionToast
        status={searchParams?.status}
        message={
          searchParams?.reason === 'slug_taken'
            ? encodeURIComponent('Project name creates a slug that already exists. Try a more specific name.')
            : searchParams?.reason === 'invalid_input'
              ? encodeURIComponent('Invalid project input. Ensure name/repository URL are valid.')
              : searchParams?.message
        }
        fallbackErrorMessage="Operation failed. Check API availability and try again."
      />

      {!data.usingLiveData && (
        <DemoModeBanner detail={data.liveDataErrorMessage}>
          API data unavailable, showing sample project data.
        </DemoModeBanner>
      )}

      {data.usingLiveData && (
        <ProjectCreatePanel
          action={createProjectAction}
          defaultOpen={projects.length === 0 || searchParams?.status === 'error'}
        />
      )}

      {projects.length === 0 ? (
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
                status={project.status}
                buttonLabel={data.usingLiveData ? 'Deploy now' : 'Deploy (mock mode)'}
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
