import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardUnavailableState } from '@/components/dashboard-unavailable-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionToast } from '@/components/action-toast';
import { FormSubmitButton } from '@/components/form-submit-button';
import { ProjectSubnav } from '@/components/project-subnav';
import { PageLayout } from '@/components/page-layout';
import {
  fetchProjectsForCurrentUser,
  resolveViewerContext,
} from '@/lib/api';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import { updateProjectGeneralAction } from './actions';
import { ServiceEditor } from './service-editor';

interface ProjectSettingsPageProps {
  params: {
    id: string;
  };
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
  };
}

export default async function ProjectSettingsPage({ params, searchParams }: ProjectSettingsPageProps) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();

  if (!viewer) {
    return (
      <PageLayout>
        <DashboardUnavailableState
          requestAuth={requestAuth}
          {...(viewerContextError ? { error: viewerContextError } : {})}
          redirectTo={`/projects/${params.id}/settings`}
        />
      </PageLayout>
    );
  }

  const projects = await fetchProjectsForCurrentUser();
  const project = projects.find((item) => item.id === params.id);

  if (!project) {
    notFound();
  }

  return (
    <PageLayout>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">Projects</Link>
        <span>/</span>
        <Link href={`/projects/${project.id}`} className="hover:text-foreground">{project.name}</Link>
        <span>/</span>
        <span className="text-foreground">Settings</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Project Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage configuration for <span className="font-medium text-foreground">{project.name}</span>.
        </p>
      </div>

      <ProjectSubnav projectId={project.id} />

      {searchParams?.status && searchParams?.message && (
        <ActionToast
          status={searchParams.status}
          message={decodeURIComponent(searchParams.message)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">General</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateProjectGeneralAction} className="space-y-4">
            <input type="hidden" name="projectId" value={project.id} />

            <div className="space-y-1">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                name="name"
                defaultValue={project.name}
                minLength={3}
                maxLength={64}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="git-repo-url">Git Repository URL</Label>
              <Input
                id="git-repo-url"
                name="gitRepositoryUrl"
                type="url"
                defaultValue={project.gitRepositoryUrl}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="default-branch">Default Branch</Label>
              <Input
                id="default-branch"
                name="defaultBranch"
                defaultValue={project.defaultBranch}
                maxLength={255}
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <FormSubmitButton
                idleText="Save Changes"
                pendingText="Saving..."
                size="sm"
              />
              <span className="text-xs text-muted-foreground">
                Project slug (<code className="font-mono">{project.slug}</code>) cannot be changed.
              </span>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Services</CardTitle>
          <p className="text-xs text-muted-foreground">
            Define the services that make up this project. Each service is deployed independently.
            Exactly one service must be public.
          </p>
        </CardHeader>
        <CardContent>
          <ServiceEditor projectId={project.id} services={project.services} />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
