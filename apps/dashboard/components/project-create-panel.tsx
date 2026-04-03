'use client';

import { useState } from 'react';
import { ProjectCreateForm } from '@/components/project-create-form';
import { Button } from '@/components/ui/button';
import type { GitHubInstallation } from '@/lib/api/github';

interface ProjectCreatePanelProps {
  action: (formData: FormData) => void | Promise<void>;
  defaultOpen?: boolean;
  githubInstallations?: GitHubInstallation[];
  githubInstallUrl?: string | null;
}

export function ProjectCreatePanel({ action, defaultOpen = false, githubInstallations = [], githubInstallUrl = null }: ProjectCreatePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="space-y-3" aria-label="Create project">
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Create project</h2>
          <p className="text-xs text-muted-foreground">Add a repository and branch to start with a default public app service.</p>
        </div>
        <Button
          type="button"
          variant={open ? 'secondary' : 'default'}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="project-create-form"
        >
          {open ? 'Hide form' : 'New Project'}
        </Button>
      </div>
      {open ? (
        <div id="project-create-form">
          <ProjectCreateForm
            action={action}
            githubInstallations={githubInstallations}
            githubInstallUrl={githubInstallUrl}
          />
        </div>
      ) : null}
    </section>
  );
}
