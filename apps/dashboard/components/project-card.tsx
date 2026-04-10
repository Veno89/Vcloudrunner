import type { ReactNode } from 'react';
import { FolderGit2, Globe, ServerCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardStatusBadgeVariant } from '@/lib/project-service-status';

interface ProjectCardProps {
  name: string;
  repo: string;
  domain: string;
  routeStatusSummary?: string;
  serviceSummary?: string;
  serviceStatusSummary?: string;
  status: string;
  statusVariant: DashboardStatusBadgeVariant;
  actions?: ReactNode;
}

function formatRepositoryLabel(repo: string): { host: string; path: string } {
  try {
    const url = new URL(repo);
    return {
      host: url.host,
      path: url.pathname.replace(/^\/+/, '') || repo
    };
  } catch {
    return {
      host: 'Repository',
      path: repo
    };
  }
}

export function ProjectCard({
  name,
  repo,
  domain,
  routeStatusSummary,
  serviceSummary,
  serviceStatusSummary,
  status,
  statusVariant,
  actions
}: ProjectCardProps) {
  const repository = formatRepositoryLabel(repo);

  return (
    <Card className="h-full rounded-2xl border-border/80">
      <CardHeader className="space-y-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base">{name}</CardTitle>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {repository.host}
            </p>
          </div>
          <Badge variant={statusVariant}>{status}</Badge>
        </div>

        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border bg-background p-2 text-muted-foreground">
              <FolderGit2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Repository
              </p>
              <p className="truncate text-sm font-medium">{repository.path}</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-3 text-sm">
        <div className="rounded-2xl border bg-background/60 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border bg-muted/20 p-2 text-muted-foreground">
              <Globe className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Public route
              </p>
              <p className="truncate font-mono text-xs text-primary">{domain}</p>
              {routeStatusSummary ? (
                <p className="text-xs text-muted-foreground">{routeStatusSummary}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-background/60 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border bg-muted/20 p-2 text-muted-foreground">
              <ServerCog className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Services
              </p>
              {serviceSummary ? <p className="text-sm">{serviceSummary}</p> : null}
              {serviceStatusSummary ? (
                <p className="text-xs text-muted-foreground">{serviceStatusSummary}</p>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>

      {actions ? (
        <CardFooter className="grid gap-2 border-t bg-muted/10">
          {actions}
        </CardFooter>
      ) : null}
    </Card>
  );
}
