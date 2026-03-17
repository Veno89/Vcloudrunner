import type { DeploymentStatus } from '@vcloudrunner/shared-types';
import { DeploymentTable } from '@/components/deployment-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/empty-state';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { PageHeader } from '@/components/page-header';
import { PageLayout } from '@/components/page-layout';
import { loadDashboardData } from '@/lib/loaders';
import { deployments as mockDeployments } from '@/lib/mock-data';
import { truncateUuid } from '@/lib/helpers';
import Link from 'next/link';

type DeploymentFilterStatus = 'all' | DeploymentStatus | 'cancelled';

interface DeploymentsPageProps {
  searchParams?: {
    status?: DeploymentFilterStatus;
    projectId?: string;
    q?: string;
    page?: string;
  };
}

export default async function DeploymentsPage({ searchParams }: DeploymentsPageProps) {
  const data = await loadDashboardData();
  const deployments = data.usingLiveData ? data.deployments : mockDeployments;
  const normalizedDeployments = deployments.map((deployment) => ({
    ...deployment,
    projectId: 'projectId' in deployment ? deployment.projectId : String(deployment.project),
    status: deployment.status as DeploymentStatus,
  }));

  const selectedStatus: 'all' | DeploymentStatus =
    searchParams?.status === 'cancelled'
      ? 'stopped'
      : searchParams?.status ?? 'all';
  const selectedProjectId = searchParams?.projectId ?? 'all';
  const selectedQuery = searchParams?.q?.trim() ?? '';
  const normalizedQuery = selectedQuery.toLowerCase();
  const currentPage = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1);
  const pageSize = 12;

  const projectOptions = Array.from(
    new Map(normalizedDeployments.map((deployment) => [deployment.projectId, deployment.project])).entries()
  ).map(([id, name]) => ({ id: String(id), name: String(name) }));

  const filteredDeployments = normalizedDeployments.filter((deployment) => {
    const statusMatch = selectedStatus === 'all' || deployment.status === selectedStatus;
    const projectMatch = selectedProjectId === 'all' || deployment.projectId === selectedProjectId;
    const queryMatch =
      normalizedQuery.length === 0 ||
      deployment.project.toLowerCase().includes(normalizedQuery) ||
      deployment.id.toLowerCase().includes(normalizedQuery) ||
      deployment.status.toLowerCase().includes(normalizedQuery) ||
      deployment.commitSha.toLowerCase().includes(normalizedQuery);
    return statusMatch && projectMatch && queryMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredDeployments.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pagedDeployments = filteredDeployments.slice(pageStart, pageStart + pageSize);

  const buildDeploymentsHref = (page: number) => {
    const params = new URLSearchParams();
    params.set('status', selectedStatus);
    params.set('projectId', selectedProjectId);
    if (selectedQuery.length > 0) {
      params.set('q', selectedQuery);
    }
    params.set('page', String(page));
    return `/deployments?${params.toString()}`;
  };

  return (
    <PageLayout>
      <PageHeader
        title="Deployments"
        description="Recent deployments across all projects."
      />

      {!data.usingLiveData && (
        <DemoModeBanner>API data unavailable, showing sample deployment data.</DemoModeBanner>
      )}

      <form className="grid gap-2 md:grid-cols-[220px_220px_1fr_auto]">
        <Label htmlFor="deployment-status-filter" className="sr-only">Filter deployments by status</Label>
        <Select id="deployment-status-filter" name="status" defaultValue={selectedStatus}>
          <option value="all">All statuses</option>
          <option value="queued">queued</option>
          <option value="building">building</option>
          <option value="running">running</option>
          <option value="failed">failed</option>
          <option value="stopped">stopped</option>
        </Select>
        <Label htmlFor="deployment-project-filter" className="sr-only">Filter deployments by project</Label>
        <Label htmlFor="deployment-query" className="sr-only">Search deployments</Label>
        <Input
          id="deployment-query"
          name="q"
          defaultValue={selectedQuery}
          placeholder="Search by project, id, commit, or status"
        />
        <Select id="deployment-project-filter" name="projectId" defaultValue={selectedProjectId}>
          <option value="all">All projects</option>
          {projectOptions.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
        <input type="hidden" name="page" value="1" />
        <Button type="submit" variant="outline" className="w-fit">Apply filters</Button>
      </form>

      {pagedDeployments.length === 0 ? (
        <EmptyState
          title={selectedStatus === 'all' ? 'No deployments yet' : 'No matching deployments'}
          description={
            selectedStatus === 'all' && selectedProjectId === 'all' && selectedQuery.length === 0
              ? 'Trigger a deployment from the Projects page to see activity here.'
              : 'Try adjusting filters/search or open Projects to trigger a new deployment.'
          }
          actions={
            <>
              {(selectedStatus !== 'all' || selectedProjectId !== 'all' || selectedQuery.length > 0) && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/deployments?status=all&projectId=all&page=1">Clear filters</Link>
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
          <DeploymentTable deployments={pagedDeployments} />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
            <p>
              Showing {Math.min(filteredDeployments.length, pageStart + 1)}-
              {Math.min(filteredDeployments.length, pageStart + pagedDeployments.length)} of {filteredDeployments.length}
            </p>
            <div className="flex items-center gap-2">
              {safePage <= 1 ? (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href={buildDeploymentsHref(safePage - 1)}>Previous</Link>
                </Button>
              )}
              <span className="text-xs">Page {safePage} of {totalPages}</span>
              {safePage >= totalPages ? (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href={buildDeploymentsHref(safePage + 1)}>Next</Link>
                </Button>
              )}
            </div>
          </div>

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

function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) {
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
