import { Activity, AlertTriangle, Boxes, Rocket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProjectWorkspaceOverviewProps {
  projectCount: number;
  healthyCount: number;
  deployingCount: number;
  attentionCount: number;
  usingLiveData: boolean;
}

const metricCards = [
  {
    key: 'projects',
    label: 'Projects',
    icon: Boxes,
    iconClassName: 'text-sky-100',
    iconShellClassName: 'border-sky-300/20 bg-sky-400/10'
  },
  {
    key: 'healthy',
    label: 'Healthy',
    icon: Activity,
    iconClassName: 'text-emerald-100',
    iconShellClassName: 'border-emerald-300/20 bg-emerald-400/10'
  },
  {
    key: 'deploying',
    label: 'Deploying',
    icon: Rocket,
    iconClassName: 'text-amber-100',
    iconShellClassName: 'border-amber-300/20 bg-amber-400/10'
  },
  {
    key: 'attention',
    label: 'Attention',
    icon: AlertTriangle,
    iconClassName: 'text-rose-100',
    iconShellClassName: 'border-rose-300/20 bg-rose-400/10'
  }
] as const;

export function ProjectWorkspaceOverview({
  projectCount,
  healthyCount,
  deployingCount,
  attentionCount,
  usingLiveData
}: ProjectWorkspaceOverviewProps) {
  const values = {
    projects: projectCount,
    healthy: healthyCount,
    deploying: deployingCount,
    attention: attentionCount
  };

  return (
    <section className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
      <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
        <CardHeader className="space-y-3 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_42%),rgba(255,255,255,0.02)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Workspace
          </p>
          <div className="space-y-2">
            <CardTitle className="font-display text-2xl text-white">Run your projects from one calmer surface.</CardTitle>
            <p className="max-w-2xl text-sm leading-7 text-slate-400">
              Create repos, trigger deployments, and keep an eye on health without hopping across
              separate admin pages.
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map(({ key, label, icon: Icon, iconClassName, iconShellClassName }) => (
            <div key={key} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {label}
                </p>
                <div className={`rounded-2xl border p-2 ${iconShellClassName}`}>
                  <Icon className={`h-4 w-4 ${iconClassName}`} />
                </div>
              </div>
              <p className="pt-4 text-3xl font-semibold tracking-tight text-white">
                {values[key]}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
        <CardHeader className="space-y-2 border-b border-white/10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Mode
          </p>
          <CardTitle className="font-display text-2xl text-white">
            {usingLiveData ? 'Live control path active' : 'Preview mode active'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-7 text-slate-400">
          <p>
            {usingLiveData
              ? 'You are working against the live platform APIs, so project creation and deploy actions will take effect immediately.'
              : 'The page can still help you learn the flow, but actions will stay limited until live dashboard auth and APIs are available.'}
          </p>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Recommended rhythm
            </p>
            <p className="pt-2 text-sm text-slate-200">
              Start by creating or opening a project, then add environment variables and deploy from the same workspace.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
