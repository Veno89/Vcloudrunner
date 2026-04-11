'use client';

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { CheckCircle2, GitBranchPlus, Layers3, ShieldCheck, Sparkles } from 'lucide-react';
import { ProjectCreateForm } from '@/components/project-create-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import type { GitHubInstallation } from '@/lib/api/github';

interface ProjectCreatePanelProps {
  action: (formData: FormData) => void | Promise<void>;
  defaultOpen?: boolean;
  githubInstallations?: GitHubInstallation[];
  githubInstallUrl?: string | null;
  projectCount?: number;
  submissionError?: string | null;
  submissionReason?: string | null;
}

export function ProjectCreatePanel({
  action,
  defaultOpen = false,
  githubInstallations = [],
  githubInstallUrl = null,
  projectCount = 0,
  submissionError = null,
  submissionReason = null
}: ProjectCreatePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasProjects = projectCount > 0;
  const hasGitHub = githubInstallations.length > 0;

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <section aria-label="Create project">
      <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
        <CardHeader className="gap-6 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_40%),rgba(255,255,255,0.02)] md:flex-row md:items-start md:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
              <Sparkles className="h-3.5 w-3.5" />
              {hasProjects ? 'Create another project' : 'First project'}
            </div>
            <div className="space-y-2">
              <CardTitle className="font-display text-2xl text-white">
                {hasProjects ? 'Bring another repository into the workspace.' : 'Launch your first repository into Vcloudrunner.'}
              </CardTitle>
              <CardDescription className="max-w-2xl leading-7 text-slate-400">
                Start with one public app service, then grow into multi-service setups later.
                {hasGitHub
                  ? ' You can pick from your connected GitHub installs or paste a repository URL manually.'
                  : ' Paste a repository URL now, or connect GitHub later for a smoother picker flow.'}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <Button
              ref={triggerRef}
              type="button"
              variant="default"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={dialogId}
              className="min-w-44 bg-sky-300 text-slate-950 hover:bg-sky-200"
            >
              <GitBranchPlus className="mr-2 h-4 w-4" />
              {hasProjects ? 'New Project' : 'Create Project'}
            </Button>
            <p className="text-xs leading-5 text-slate-500">
              Guided setup with inline validation and GitHub-aware source selection.
            </p>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 p-6 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 text-sky-100">
                <Layers3 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Starter shape</p>
                <p className="pt-1 text-sm text-slate-200">One public app service to begin with.</p>
              </div>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 text-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">What you save</p>
                <p className="pt-1 text-sm text-slate-200">Repo, branch, slug, and the initial service layout.</p>
              </div>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 text-amber-100">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Flow quality</p>
                <p className="pt-1 text-sm text-slate-200">Errors show next to the fields that need attention.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Create a new project"
        description="Set the project name, choose the source repository, and let Vcloudrunner wire up the initial service layout."
        returnFocusRef={triggerRef as unknown as RefObject<HTMLElement>}
        contentId={dialogId}
        contentClassName="max-w-6xl border-white/10 bg-[#08111f]/95 p-0"
      >
        <div className="border-t border-white/10 p-5 sm:p-7">
          <ProjectCreateForm
            action={action}
            githubInstallations={githubInstallations}
            githubInstallUrl={githubInstallUrl}
            submissionError={submissionError}
            submissionReason={submissionReason}
          />
        </div>
      </Dialog>
    </section>
  );
}
