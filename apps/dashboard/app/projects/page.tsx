import { ProjectCard } from '@/components/project-card';
import { ProjectCreateForm } from '@/components/project-create-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ActionToast } from '@/components/action-toast';
import { FormSubmitButton } from '@/components/form-submit-button';
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground">
          Manage your projects and trigger deployments.
        </p>
      </div>

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
        <div className="rounded-md border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Demo mode: API data unavailable, showing sample project data.
        </div>
      )}

      {data.usingLiveData && <ProjectCreateForm action={createProjectAction} />}

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No projects yet. Create your first project to start deployments.
          </CardContent>
        </Card>
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
    </div>
  );
}
