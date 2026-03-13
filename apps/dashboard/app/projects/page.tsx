import { ProjectCard } from '@/components/project-card';
import { ProjectCreateForm } from '@/components/project-create-form';
import { Card, CardContent } from '@/components/ui/card';
import { loadDashboardData } from '@/lib/loaders';
import { projects as mockProjects } from '@/lib/mock-data';
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
  const projects = data.usingLiveData && data.projects.length > 0 ? data.projects : mockProjects;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground">
          Manage your projects and trigger deployments.
        </p>
      </div>

      {searchParams?.status === 'success' && searchParams.message && (
        <div className="rounded-md border border-emerald-700/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          {decodeURIComponent(searchParams.message)}
        </div>
      )}
      {searchParams?.status === 'error' && (
        <div className="rounded-md border border-rose-700/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {searchParams.reason === 'slug_taken'
            ? 'Project name creates a slug that already exists. Try a more specific name.'
            : searchParams.reason === 'invalid_input'
              ? 'Invalid project input. Ensure name/repository URL are valid.'
              : searchParams.message
                ? decodeURIComponent(searchParams.message)
                : 'Operation failed. Check API availability and try again.'}
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
                <form action={triggerDeploymentAction}>
                  <input name="projectId" value={project.id} type="hidden" readOnly />
                  <input name="projectName" value={project.name} type="hidden" readOnly />
                  <button
                    type="submit"
                    className="w-full rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    Trigger Deployment Job
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
