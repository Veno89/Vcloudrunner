import type { DeploymentStatus } from '@vcloudrunner/shared-types';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function deploymentStatusVariant(status: DeploymentStatus) {
  if (status === 'running') return 'success' as const;
  if (status === 'building' || status === 'queued') return 'warning' as const;
  if (status === 'failed') return 'destructive' as const;
  return 'secondary' as const;
}

export function DeploymentStatusBadges({
  status,
  cancellationRequested = false,
  className
}: {
  status: DeploymentStatus;
  cancellationRequested?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge variant={deploymentStatusVariant(status)}>{status}</Badge>
      {cancellationRequested && (status === 'queued' || status === 'building') ? (
        <Badge variant="secondary">cancelling</Badge>
      ) : null}
    </div>
  );
}
