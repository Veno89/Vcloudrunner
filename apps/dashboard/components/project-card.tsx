import type { DeploymentStatus } from '@vcloudrunner/shared-types';

import { DeploymentStatusBadges } from '@/components/deployment-status-badges';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProjectCardProps {
  name: string;
  repo: string;
  domain: string;
  status: string;
  deploymentStatus?: DeploymentStatus;
  cancellationRequested?: boolean;
}

export function ProjectCard({
  name,
  repo,
  domain,
  status,
  deploymentStatus,
  cancellationRequested = false
}: ProjectCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{name}</CardTitle>
          {deploymentStatus ? (
            <DeploymentStatusBadges
              status={deploymentStatus}
              cancellationRequested={cancellationRequested}
            />
          ) : (
            <Badge variant={status === 'history unavailable' ? 'warning' : 'secondary'}>
              {status}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-xs">
        <p className="truncate text-muted-foreground">{repo}</p>
        <p className="truncate text-primary">{domain}</p>
      </CardContent>
    </Card>
  );
}
