import type { ReactNode } from 'react';
import Link from 'next/link';
import { FolderGit2, Globe, ServerCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardStatusBadgeVariant } from '@/lib/project-service-status';

interface ProjectCardProps {
  href?: string;
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
  href,
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
  const content = (
    <>
      <CardHeader className="space-y-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg text-white">{name}</CardTitle>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              {repository.host}
            </p>
          </div>
          <Badge variant={statusVariant}>{status}</Badge>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-2 text-slate-300">
              <FolderGit2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Repository
              </p>
              <p className="truncate text-sm font-medium text-slate-100">{repository.path}</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-3 text-sm">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-2 text-slate-300">
              <Globe className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Public route
              </p>
              <p className="truncate font-mono text-xs text-sky-200">{domain}</p>
              {routeStatusSummary ? (
                <p className="text-xs text-slate-400">{routeStatusSummary}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-2 text-slate-300">
              <ServerCog className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Services
              </p>
              {serviceSummary ? <p className="text-sm text-slate-100">{serviceSummary}</p> : null}
              {serviceStatusSummary ? (
                <p className="text-xs text-slate-400">{serviceStatusSummary}</p>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </>
  );

  return (
    <Card className="group h-full overflow-hidden rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:border-sky-300/20 hover:shadow-[0_24px_70px_rgba(14,165,233,0.12)]">
      {href ? (
        <Link
          href={href}
          className="block rounded-t-[2rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {content}
        </Link>
      ) : content}

      {actions ? (
        <CardFooter className="grid gap-2 border-t border-white/10 bg-white/[0.03]">
          {actions}
        </CardFooter>
      ) : null}
    </Card>
  );
}
