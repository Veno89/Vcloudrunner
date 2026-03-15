import { DeploymentTable } from '@/components/deployment-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { PageLayout } from '@/components/page-layout';
import { loadDashboardData } from '@/lib/loaders';
import { deployments as mockDeployments } from '@/lib/mock-data';
import { truncateUuid } from '@/lib/helpers';
import Link from 'next/link';

interface DeploymentsPageProps {
  searchParams?: {
    status?: 'all' | 'queued' | 'building' | 'running' | 'failed' | 'cancelled';
    projectId?: string;
  };
}

export default async function DeploymentsPage({ searchParams }: DeploymentsPageProps) {
  const data = await loadDashboardData();
  const deployments = data.usingLiveData ? data.deployments : mockDeployments;
  const normalizedDeployments = deployments.map((deployment) => ({
    ...deployment,
    projectId: 'projectId' in deployment ? deployment.projectId : deployment.project,
  }));

  const selectedStatus = searchParams?.status ?? 'all';
  const selectedProjectId = searchParams?.projectId ?? 'all';

  const projectOptions = Array.from(
    new Map(normalizedDeployments.map((deployment) => [deployment.projectId, deployment.project])).entries()
  ).map(([id, name]) => ({ id: String(id), name: String(name) }));

  const filteredDeployments = normalizedDeployments.filter((deployment) => {
    const statusMatch = selectedStatus === 'all' || deployment.status === selectedStatus;
    const projectMatch = selectedProjectId === 'all' || deployment.projectId === selectedProjectId;
    return statusMatch && projectMatch;
  });

  return (
    <PageLayout>
      <PageHeader
        title="Deployments"
        description="Recent deployments across all projects."
      />

      {!data.usingLiveData && (
        <div className="rounded-md border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Demo mode: API data unavailable, showing sample deployment data.
        </div>
      )}

      <form className="grid gap-2 md:grid-cols-[220px_220px_auto]">
        <Label htmlFor="deployment-status-filter" className="sr-only">Filter deployments by status</Label>
        <Select id="deployment-status-filter" name="status" defaultValue={selectedStatus}>
          <option value="all">All statuses</option>
          <option value="queued">queued</option>
          <option value="building">building</option>
          <option value="running">running</option>
          <option value="failed">failed</option>
          <option value="cancelled">cancelled</option>
        </Select>
        <Label htmlFor="deployment-project-filter" className="sr-only">Filter deployments by project</Label>
        <Select id="deployment-project-filter" name="projectId" defaultValue={selectedProjectId}>
          <option value="all">All projects</option>
          {projectOptions.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline" className="w-fit">Apply filter</Button>
      </form>

      {filteredDeployments.length === 0 ? (
        <EmptyState
          title={selectedStatus === 'all' ? 'No deployments yet' : 'No matching deployments'}
          description={
            selectedStatus === 'all'
              ? 'Trigger a deployment from the Projects page to see activity here.'
              : 'Try adjusting filters or open Projects to trigger a new deployment.'
          }
          actions={
            <>
              {(selectedStatus !== 'all' || selectedProjectId !== 'all') && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/deployments?status=all&projectId=all">Clear filters</Link>
                </Button>
              )}
              <Button asChild size="sm">
                <Link href="/projects">Open Projects</Link>
              </Button>
            </>
          }
        />
      ) : (
        <>
          <DeploymentTable deployments={filteredDeployments} />

          {data.usingLiveData && data.sortedDeployments.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Quick Links</h2>
              <div className="flex flex-wrap gap-2">
                {data.sortedDeployments.slice(0, 10).map(({ deployment, project }) => (
                  <Link
                    key={deployment.id}
                    href={`/deployments/${deployment.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                  >
                    <span className="text-muted-foreground">{project.name}</span>
                    <span className="font-mono">{truncateUuid(deployment.id)}</span>
                    <DeploymentStatusBadge status={deployment.status} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}

function DeploymentStatusBadge({ status }: { status: string }) {
  const variant =
    status === 'running'
      ? 'success'
      : status === 'building' || status === 'queued'
        ? 'warning'
        : status === 'failed'
          ? 'destructive'
          : 'secondary';

  return <Badge variant={variant}>{status}</Badge>;
}
