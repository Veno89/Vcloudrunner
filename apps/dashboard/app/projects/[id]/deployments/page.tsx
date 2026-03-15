import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectSubnav } from '@/components/project-subnav';
import { PageLayout } from '@/components/page-layout';
import { EmptyState } from '@/components/empty-state';
import { FormSubmitButton } from '@/components/form-submit-button';
import {
  demoUserId,
  fetchProjectsForDemoUser,
  fetchDeploymentsForProject,
} from '@/lib/api';
import { formatRelativeTime, truncateUuid } from '@/lib/helpers';
import { deployProjectAction } from '@/app/deployments/actions';

interface ProjectDeploymentsPageProps {
  params: {
    id: string;
  };
}

function deploymentStatusVariant(status: string) {
  if (status === 'running') return 'success' as const;
  if (status === 'queued' || status === 'building') return 'warning' as const;
  if (status === 'failed') return 'destructive' as const;
  return 'secondary' as const;
}

export default async function ProjectDeploymentsPage({ params }: ProjectDeploymentsPageProps) {
  if (!demoUserId) {
    notFound();
  }

  const projects = await fetchProjectsForDemoUser();
  const project = projects.find((item) => item.id === params.id);

  if (!project) {
    notFound();
  }

  const deployments = await fetchDeploymentsForProject(project.id);
  const sortedDeployments = deployments
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return (
    <PageLayout>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">Projects</Link>
        <span>/</span>
        <Link href={`/projects/${project.id}`} className="hover:text-foreground">{project.name}</Link>
        <span>/</span>
        <span className="text-foreground">Deployments</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Project Deployments</h1>
        <p className="text-sm text-muted-foreground">
          Deployment history for <span className="font-medium text-foreground">{project.name}</span>.
        </p>
      </div>

      <ProjectSubnav projectId={project.id} />

      <div className="flex flex-wrap gap-2">
        <form action={deployProjectAction}>
          <input type="hidden" name="projectId" value={project.id} readOnly />
          <input type="hidden" name="projectName" value={project.name} readOnly />
          <FormSubmitButton
            idleText="Deploy"
            pendingText="Deploying..."
            variant="default"
            size="sm"
          />
        </form>
      </div>

      {sortedDeployments.length === 0 ? (
        <EmptyState
          title="No deployments yet"
          description="Trigger a deployment to create the first deployment record for this project."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Deployments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedDeployments.map((deployment) => (
              <div
                key={deployment.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="space-y-1">
                  <p className="font-mono text-xs">{truncateUuid(deployment.id)}</p>
                  <p className="text-xs text-muted-foreground" title={new Date(deployment.createdAt).toLocaleString()}>
                    {formatRelativeTime(deployment.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={deploymentStatusVariant(deployment.status)}>{deployment.status}</Badge>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/deployments/${deployment.id}`}>View</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </PageLayout>
  );
}
