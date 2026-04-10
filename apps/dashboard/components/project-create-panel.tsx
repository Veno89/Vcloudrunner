'use client';

import { useState } from 'react';
import { GitBranchPlus, Sparkles } from 'lucide-react';
import { ProjectCreateForm } from '@/components/project-create-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { GitHubInstallation } from '@/lib/api/github';

interface ProjectCreatePanelProps {
  action: (formData: FormData) => void | Promise<void>;
  defaultOpen?: boolean;
  githubInstallations?: GitHubInstallation[];
  githubInstallUrl?: string | null;
  projectCount?: number;
}

export function ProjectCreatePanel({
  action,
  defaultOpen = false,
  githubInstallations = [],
  githubInstallUrl = null,
  projectCount = 0
}: ProjectCreatePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const hasProjects = projectCount > 0;
  const hasGitHub = githubInstallations.length > 0;

  return (
    <section aria-label="Create project">
      <Card className="rounded-2xl border-dashed">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              {hasProjects ? 'Create another project' : 'First project'}
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl">
                {hasProjects ? 'Bring another repository into the workspace.' : 'Launch your first repository into Vcloudrunner.'}
              </CardTitle>
              <CardDescription className="max-w-2xl leading-6">
                Start with one public app service, then grow into multi-service setups later.
                {hasGitHub
                  ? ' You can pick from your connected GitHub installs or paste a repository URL manually.'
                  : ' Paste a repository URL now, or connect GitHub later for a smoother picker flow.'}
              </CardDescription>
            </div>
          </div>

          <Button
            type="button"
            variant={open ? 'secondary' : 'default'}
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls="project-create-form"
            className="min-w-40"
          >
            <GitBranchPlus className="mr-2 h-4 w-4" />
            {open ? 'Hide form' : hasProjects ? 'New Project' : 'Create Project'}
          </Button>
        </CardHeader>

        {open ? (
          <CardContent id="project-create-form" className="pt-0">
            <ProjectCreateForm
              action={action}
              githubInstallations={githubInstallations}
              githubInstallUrl={githubInstallUrl}
            />
          </CardContent>
        ) : null}
      </Card>
    </section>
  );
}
