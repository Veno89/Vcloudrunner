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
      <Card className="rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
        <CardHeader className="space-y-4 border-b border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              <Activity className="h-4 w-4 text-emerald-300" />
              Current Status
            </div>
            <Badge variant={statusVariant} className="border-white/10">
              {statusLabel}
            </Badge>
          </div>
          <CardTitle className="font-display text-3xl tracking-tight text-white">{statusLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-7 text-slate-400">{statusBreakdown}</p>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
        <CardHeader className="space-y-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            <Rocket className="h-4 w-4 text-amber-300" />
            Recent Deployments
          </div>
          <CardTitle className="font-display text-3xl tracking-tight text-white">
            {deploymentCount === null ? 'Unavailable' : deploymentCount}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm leading-7 text-slate-400">
            {deploymentCount === null
              ? 'Deployment history could not be loaded right now.'
              : deploymentCount === 0
                ? 'No deployments have run for this project yet.'
                : `Latest activity ${latestDeploymentRelative ?? 'recently'}.`}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
        <CardHeader className="space-y-4 border-b border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              <Globe2 className="h-4 w-4 text-sky-300" />
              Active Domains
            </div>
            <Badge variant={routeVariant} className="border-white/10">
              {routeLabel}
            </Badge>
          </div>
          <CardTitle className="font-display text-3xl tracking-tight text-white">
            {domainCount === null ? 'Unavailable' : domainCount}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="font-mono text-xs text-sky-200">{primaryHost}</p>
          <p className="text-sm leading-7 text-slate-400">
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
