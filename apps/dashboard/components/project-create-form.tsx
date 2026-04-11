'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, GitBranch, Globe2, Rocket, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormSubmitButton } from '@/components/form-submit-button';
import { HelpTip } from '@/components/help-tip';
import { TIPS } from '@/lib/onboarding/steps';
import { slugifyProjectName } from '@/lib/helpers';
import { GitHubRepoPicker } from '@/components/github-repo-picker';
import type { GitHubInstallation, GitHubRepository } from '@/lib/api/github';
import { cn } from '@/lib/utils';

function isValidGitUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function branchValidationMessage(value: string): string | null {
  if (value.length === 0) {
    return null;
  }

  const branchPattern = /^[A-Za-z0-9._/-]+$/;
  if (!branchPattern.test(value)) {
    return 'Branch name can only include letters, numbers, dot, underscore, slash, and dash.';
  }

  if (value.startsWith('/') || value.endsWith('/') || value.includes('//')) {
    return 'Branch name cannot start/end with slash or include consecutive slashes.';
  }

  return null;
}

interface ProjectCreateFormProps {
  action: (formData: FormData) => void | Promise<void>;
  githubInstallations?: GitHubInstallation[];
  githubInstallUrl?: string | null;
  submissionError?: string | null;
  submissionReason?: string | null;
}

type TouchedField = 'name' | 'repository' | 'branch';

function fieldInputClassName(hasError: boolean) {
  return cn(
    'h-11 rounded-2xl border-white/10 bg-slate-950/80 text-slate-100 placeholder:text-slate-500',
    hasError ? 'border-rose-400/55 ring-1 ring-rose-400/30 focus-visible:ring-rose-300' : 'focus-visible:ring-sky-200'
  );
}

function HelperText({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'error' }) {
  return (
    <p className={cn('text-xs leading-6', tone === 'error' ? 'text-rose-200' : 'text-slate-500')}>
      {children}
    </p>
  );
}

export function ProjectCreateForm({
  action,
  githubInstallations = [],
  githubInstallUrl = null,
  submissionError = null,
  submissionReason = null
}: ProjectCreateFormProps) {
  const [name, setName] = useState('');
  const [gitRepositoryUrl, setGitRepositoryUrl] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [githubInstallationId, setGithubInstallationId] = useState<number | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<{ fullName: string; installationId: number } | null>(null);
  const [touched, setTouched] = useState<Record<TouchedField, boolean>>({
    name: false,
    repository: false,
    branch: false
  });
  const [didAttemptSubmit, setDidAttemptSubmit] = useState(false);

  const hasGitHub = githubInstallations.length > 0;
  const slugConflict = submissionReason === 'slug_taken';

  const markTouched = (field: TouchedField) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const handleRepoSelect = (repo: GitHubRepository, installationId: number) => {
    setGitRepositoryUrl(repo.cloneUrl);
    setDefaultBranch(repo.defaultBranch);
    setGithubInstallationId(installationId);
    setSelectedRepo({ fullName: repo.fullName, installationId });
    markTouched('repository');
    if (!name) {
      setName(repo.name.charAt(0).toUpperCase() + repo.name.slice(1).replace(/-/g, ' '));
    }
  };

  const handleRepoClear = () => {
    setGitRepositoryUrl('');
    setGithubInstallationId(null);
    setSelectedRepo(null);
    markTouched('repository');
  };

  const slug = useMemo(() => slugifyProjectName(name), [name]);
  const nameError = name.trim().length < 3 ? 'Project name must be at least 3 characters.' : null;
  const slugError = slug.length < 3 ? 'Project slug must contain at least 3 valid characters.' : null;
  const urlError = gitRepositoryUrl.length > 0 && !isValidGitUrl(gitRepositoryUrl)
    ? 'Repository URL must be a valid http/https URL.'
    : null;
  const repositoryError = gitRepositoryUrl.trim().length === 0
    ? 'Choose a repository or paste a repository URL.'
    : urlError;
  const branchError = branchValidationMessage(defaultBranch.trim());

  const showNameError = touched.name || didAttemptSubmit || slugConflict;
  const showRepositoryError = touched.repository || didAttemptSubmit;
  const showBranchError = touched.branch || didAttemptSubmit;
  const showSlugError = touched.name || didAttemptSubmit || slugConflict;

  const inlineNameError = slugConflict
    ? 'Another project already uses this generated slug. Try a more specific project name.'
    : nameError;
  const inlineSlugError = slugConflict
    ? 'This slug is already in use across the platform.'
    : slugError;

  const formInvalid = Boolean(nameError || slugError || repositoryError || branchError);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!formInvalid) {
      return;
    }

    event.preventDefault();
    setDidAttemptSubmit(true);
    setTouched({
      name: true,
      repository: true,
      branch: true
    });
  };

  return (
    <form action={action} onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
      {githubInstallationId ? (
        <input type="hidden" name="githubInstallationId" value={githubInstallationId} />
      ) : null}

      <aside className="space-y-5 rounded-[2rem] border border-white/10 bg-slate-950/72 p-6 shadow-[0_24px_64px_rgba(2,6,23,0.26)]">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
            <Sparkles className="h-3.5 w-3.5" />
            Guided setup
          </div>
          <div className="space-y-2">
            <h3 className="font-display text-2xl font-semibold tracking-tight text-white">
              Launch a project with a calmer first-run flow.
            </h3>
            <p className="text-sm leading-7 text-slate-400">
              We'll keep the first deploy simple: name the project, choose the repository, and start with one public app service.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            {
              step: '01',
              title: 'Define the project identity',
              detail: 'Choose a readable project name. The slug preview updates instantly so collisions are easy to spot.'
            },
            {
              step: '02',
              title: 'Connect the source repository',
              detail: hasGitHub
                ? 'Pick a repository from GitHub or paste the clone URL yourself.'
                : 'Paste a repository URL now, then add GitHub installs later if you want a picker.'
            },
            {
              step: '03',
              title: 'Launch into the workspace',
              detail: 'Vcloudrunner stores the repo, default branch, and initial service layout so the project is ready for env setup and deploy.'
            }
          ].map((item) => (
            <div key={item.step} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/80 text-xs font-semibold text-slate-100">
                  {item.step}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-100">{item.title}</p>
                  <p className="text-xs leading-6 text-slate-400">{item.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[1.5rem] border border-emerald-300/15 bg-emerald-400/8 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
            Ready on create
          </p>
          <div className="mt-3 space-y-3">
            {[
              'Project name and globally unique slug',
              'Repository URL and chosen default branch',
              'One public app service for the initial deploy'
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm text-emerald-50">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="space-y-6">
        {submissionError ? (
          <div className="rounded-[1.5rem] border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-50">
            {submissionError}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          {[
            { label: 'Basics', value: 'Name + branch', icon: Rocket },
            { label: 'Source', value: hasGitHub ? 'GitHub or URL' : 'Repository URL', icon: Globe2 },
            { label: 'Deploy shape', value: '1 public app service', icon: GitBranch }
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
                  <p className="pt-1 text-sm text-slate-200">{value}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-2 text-slate-300">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
          <section className="space-y-5 rounded-[2rem] border border-white/10 bg-slate-950/72 p-6 shadow-[0_24px_64px_rgba(2,6,23,0.26)]">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Basics
              </p>
              <h3 className="text-lg font-semibold tracking-tight text-white">Name the project and choose its branch.</h3>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="project-name" className="text-xs uppercase tracking-[0.18em] text-slate-300">Project name</Label>
                  <HelpTip label={TIPS.PROJECT_NAME.label} side="right" />
                </div>
                <Input
                  id="project-name"
                  type="text"
                  name="name"
                  placeholder="Venos Workshop"
                  minLength={3}
                  required
                  value={name}
                  data-autofocus="true"
                  aria-invalid={showNameError && Boolean(inlineNameError)}
                  className={fieldInputClassName(showNameError && Boolean(inlineNameError))}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => markTouched('name')}
                />
                {showNameError && inlineNameError ? (
                  <HelperText tone="error">{inlineNameError}</HelperText>
                ) : (
                  <HelperText>Use the display name your team will recognize in the workspace.</HelperText>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="project-branch" className="text-xs uppercase tracking-[0.18em] text-slate-300">Default branch</Label>
                  <HelpTip label={TIPS.PROJECT_BRANCH.label} side="right" />
                </div>
                <Input
                  id="project-branch"
                  type="text"
                  name="defaultBranch"
                  placeholder="main"
                  value={defaultBranch}
                  aria-invalid={showBranchError && Boolean(branchError)}
                  className={fieldInputClassName(showBranchError && Boolean(branchError))}
                  onChange={(event) => setDefaultBranch(event.target.value)}
                  onBlur={() => markTouched('branch')}
                />
                {showBranchError && branchError ? (
                  <HelperText tone="error">{branchError}</HelperText>
                ) : (
                  <HelperText>Leave it as `main`, or switch to the branch you want the first deploy to track.</HelperText>
                )}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Slug preview
              </p>
              <div className="grid gap-4 pt-3 md:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <p className="font-mono text-sm text-slate-100">{slug || '(empty)'}</p>
                  {showSlugError && inlineSlugError ? (
                    <HelperText tone="error">{inlineSlugError}</HelperText>
                  ) : (
                    <HelperText>Slugs stay lowercase, come from the project name, and must be globally unique.</HelperText>
                  )}
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Initial route shape</p>
                  <p className="pt-2 text-sm text-slate-200">{slug || 'project-name'}.apps...</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-5 rounded-[2rem] border border-white/10 bg-slate-950/72 p-6 shadow-[0_24px_64px_rgba(2,6,23,0.26)]">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Source
              </p>
              <h3 className="text-lg font-semibold tracking-tight text-white">Choose the repository to deploy.</h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="project-repository" className="text-xs uppercase tracking-[0.18em] text-slate-300">Repository</Label>
                <HelpTip label={TIPS.PROJECT_REPO.label} side="right" />
              </div>
              {hasGitHub || githubInstallUrl ? (
                <div className="space-y-4">
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                    <GitHubRepoPicker
                      installations={githubInstallations}
                      installUrl={githubInstallUrl}
                      onSelect={handleRepoSelect}
                      onClear={handleRepoClear}
                      selected={selectedRepo}
                    />
                  </div>
                  {!selectedRepo ? (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Or paste a repository URL manually</p>
                      <Input
                        id="project-repository"
                        type="url"
                        name="gitRepositoryUrl"
                        placeholder="https://github.com/org/repo"
                        value={gitRepositoryUrl}
                        aria-invalid={showRepositoryError && Boolean(repositoryError)}
                        className={fieldInputClassName(showRepositoryError && Boolean(repositoryError))}
                        onChange={(event) => setGitRepositoryUrl(event.target.value)}
                        onBlur={() => markTouched('repository')}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-[1.5rem] border border-emerald-300/15 bg-emerald-400/8 p-4">
                      <input type="hidden" name="gitRepositoryUrl" value={gitRepositoryUrl} />
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Selected from GitHub</p>
                      <p className="text-sm text-emerald-50">{selectedRepo.fullName}</p>
                      <HelperText>The clone URL will be saved for deployment, and the installation ID will stay attached to the project.</HelperText>
                    </div>
                  )}
                </div>
              ) : (
                <Input
                  id="project-repository"
                  type="url"
                  name="gitRepositoryUrl"
                  placeholder="https://github.com/org/repo"
                  required
                  value={gitRepositoryUrl}
                  aria-invalid={showRepositoryError && Boolean(repositoryError)}
                  className={fieldInputClassName(showRepositoryError && Boolean(repositoryError))}
                  onChange={(event) => setGitRepositoryUrl(event.target.value)}
                  onBlur={() => markTouched('repository')}
                />
              )}
              {showRepositoryError && repositoryError ? (
                <HelperText tone="error">{repositoryError}</HelperText>
              ) : (
                <HelperText>Start with any reachable Git repository. You can refine service composition after the project exists.</HelperText>
              )}
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-sm leading-7 text-slate-300">
              New projects start with one public <span className="font-mono text-slate-100">app</span> service.
              You can add more services, routes, and richer compositions after the project exists.
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4 rounded-[1.75rem] border border-white/10 bg-white/[0.04] px-5 py-4 md:flex-row md:items-center md:justify-between">
          <p className="max-w-2xl text-sm leading-7 text-slate-400">
            When you create the project, Vcloudrunner will save the repo, branch, and default service layout so you can move straight into environment setup and deploy.
          </p>
          <FormSubmitButton
            idleText="Create Project"
            pendingText="Creating..."
            disabled={formInvalid}
            className="bg-sky-300 text-slate-950 hover:bg-sky-200"
          />
        </div>
      </div>
    </form>
  );
}
