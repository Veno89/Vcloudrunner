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
    icon: Boxes
  },
  {
    key: 'healthy',
    label: 'Healthy',
    icon: Activity
  },
  {
    key: 'deploying',
    label: 'Deploying',
    icon: Rocket
  },
  {
    key: 'attention',
    label: 'Attention',
    icon: AlertTriangle
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
      <Card className="overflow-hidden">
        <CardHeader className="space-y-3 border-b bg-muted/20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Workspace
          </p>
          <div className="space-y-2">
            <CardTitle className="text-xl">Run your projects from one calmer surface.</CardTitle>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Create repos, trigger deployments, and keep an eye on health without hopping across
              separate admin pages.
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map(({ key, label, icon: Icon }) => (
            <div key={key} className="rounded-2xl border bg-background/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {label}
                </p>
                <div className="rounded-full border bg-muted/30 p-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="pt-4 text-3xl font-semibold tracking-tight">
                {values[key]}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Mode
          </p>
          <CardTitle className="text-xl">
            {usingLiveData ? 'Live control path active' : 'Preview mode active'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            {usingLiveData
              ? 'You are working against the live platform APIs, so project creation and deploy actions will take effect immediately.'
              : 'The page can still help you learn the flow, but actions will stay limited until live dashboard auth and APIs are available.'}
          </p>
          <p>
            Start by creating or opening a project, then add environment variables and deploy from the same workspace.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
