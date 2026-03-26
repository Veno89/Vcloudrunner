import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardStatusBadgeVariant } from '@/lib/project-service-status';

interface ProjectCardProps {
  name: string;
  repo: string;
  domain: string;
  serviceSummary?: string;
  serviceStatusSummary?: string;
  status: string;
  statusVariant: DashboardStatusBadgeVariant;
}

export function ProjectCard({
  name,
  repo,
  domain,
  serviceSummary,
  serviceStatusSummary,
  status,
  statusVariant
}: ProjectCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{name}</CardTitle>
          <Badge variant={statusVariant}>{status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-xs">
        <p className="truncate text-muted-foreground">{repo}</p>
        <p className="truncate text-primary">{domain}</p>
        {serviceSummary ? <p className="truncate text-muted-foreground">{serviceSummary}</p> : null}
        {serviceStatusSummary ? (
          <p className="truncate text-muted-foreground">{serviceStatusSummary}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
