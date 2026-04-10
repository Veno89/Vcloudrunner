import { Activity, Globe2, Rocket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardStatusBadgeVariant } from '@/lib/project-service-status';

interface ProjectOverviewMetricsProps {
  statusLabel: string;
  statusVariant: DashboardStatusBadgeVariant;
  statusBreakdown: string;
  deploymentCount: number | null;
  latestDeploymentRelative: string | null;
  domainCount: number | null;
  primaryHost: string;
  routeLabel: string;
  routeVariant: DashboardStatusBadgeVariant;
}

export function ProjectOverviewMetrics({
  statusLabel,
  statusVariant,
  statusBreakdown,
  deploymentCount,
  latestDeploymentRelative,
  domainCount,
  primaryHost,
  routeLabel,
  routeVariant
}: ProjectOverviewMetricsProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <Card className="rounded-2xl border-border/80">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Activity className="h-4 w-4" />
            Current Status
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl tracking-tight">{statusLabel}</CardTitle>
            <Badge variant={statusVariant} className="w-fit">
              {statusLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">{statusBreakdown}</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Rocket className="h-4 w-4" />
            Recent Deployments
          </div>
          <CardTitle className="text-3xl tracking-tight">
            {deploymentCount === null ? 'Unavailable' : deploymentCount}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {deploymentCount === null
              ? 'Deployment history could not be loaded right now.'
              : deploymentCount === 0
                ? 'No deployments have run for this project yet.'
                : `Latest activity ${latestDeploymentRelative ?? 'recently'}.`}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Globe2 className="h-4 w-4" />
            Active Domains
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl tracking-tight">
              {domainCount === null ? 'Unavailable' : domainCount}
            </CardTitle>
            <Badge variant={routeVariant} className="w-fit">
              {routeLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="font-mono text-xs text-primary">{primaryHost}</p>
          <p className="text-sm text-muted-foreground">
            {domainCount === null
              ? 'Domain visibility is temporarily degraded.'
              : domainCount === 1
                ? 'One active public route is currently attached to this project.'
                : `${domainCount} active public routes are currently attached to this project.`}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
