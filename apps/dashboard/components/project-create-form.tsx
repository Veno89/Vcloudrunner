'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormSubmitButton } from '@/components/form-submit-button';
import { HelpTip } from '@/components/help-tip';
import { TIPS } from '@/lib/onboarding/steps';
import { slugifyProjectName } from '@/lib/helpers';
import { GitHubRepoPicker } from '@/components/github-repo-picker';
import type { GitHubInstallation, GitHubRepository } from '@/lib/api/github';

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
}

export function ProjectCreateForm({ action, githubInstallations = [], githubInstallUrl = null }: ProjectCreateFormProps) {
  const [name, setName] = useState('');
  const [gitRepositoryUrl, setGitRepositoryUrl] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [githubInstallationId, setGithubInstallationId] = useState<number | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<{ fullName: string; installationId: number } | null>(null);

  const hasGitHub = githubInstallations.length > 0;

  const handleRepoSelect = (repo: GitHubRepository, installationId: number) => {
    setGitRepositoryUrl(repo.cloneUrl);
    setDefaultBranch(repo.defaultBranch);
    setGithubInstallationId(installationId);
    setSelectedRepo({ fullName: repo.fullName, installationId });
    if (!name) {
      setName(repo.name.charAt(0).toUpperCase() + repo.name.slice(1).replace(/-/g, ' '));
    }
  };

  const handleRepoClear = () => {
    setGitRepositoryUrl('');
    setGithubInstallationId(null);
    setSelectedRepo(null);
  };

  const slug = useMemo(() => slugifyProjectName(name), [name]);
  const nameError = name.trim().length < 3 ? 'Project name must be at least 3 characters.' : null;
  const slugError = slug.length < 3 ? 'Project slug must contain at least 3 valid characters.' : null;
  const urlError = gitRepositoryUrl.length > 0 && !isValidGitUrl(gitRepositoryUrl)
    ? 'Repository URL must be a valid http/https URL.'
    : null;
  const branchError = branchValidationMessage(defaultBranch.trim());

  const formInvalid = Boolean(nameError || slugError || urlError || branchError || gitRepositoryUrl.trim().length === 0);

  return (
    <form action={action} className="space-y-5 rounded-2xl border bg-card/70 p-5">
      {githubInstallationId ? (
        <input type="hidden" name="githubInstallationId" value={githubInstallationId} />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Basics
            </p>
            <h3 className="text-lg font-semibold tracking-tight">Name the project and choose its branch.</h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="project-name" className="text-xs">Project name</Label>
              <HelpTip label={TIPS.PROJECT_NAME.label} side="right" />
            </div>
            <Input
              id="project-name"
              type="text"
              name="name"
              placeholder="Project name"
              minLength={3}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="project-branch" className="text-xs">Default branch</Label>
              <HelpTip label={TIPS.PROJECT_BRANCH.label} side="right" />
            </div>
            <Input
              id="project-branch"
              type="text"
              name="defaultBranch"
              placeholder="main"
              value={defaultBranch}
              onChange={(event) => setDefaultBranch(event.target.value)}
            />
          </div>

          <div className="rounded-2xl border bg-muted/20 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Slug preview
            </p>
            <p className="pt-2 font-mono text-foreground">{slug || '(empty)'}</p>
            <p className="pt-2 text-xs leading-6 text-muted-foreground">
              Slugs come from the project name, stay lowercase, and must be globally unique.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Source
            </p>
            <h3 className="text-lg font-semibold tracking-tight">Choose the repository to deploy.</h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="project-repository" className="text-xs">Repository</Label>
              <HelpTip label={TIPS.PROJECT_REPO.label} side="right" />
            </div>
            {hasGitHub || githubInstallUrl ? (
              <div className="space-y-3">
                <GitHubRepoPicker
                  installations={githubInstallations}
                  installUrl={githubInstallUrl}
                  onSelect={handleRepoSelect}
                  onClear={handleRepoClear}
                  selected={selectedRepo}
                />
                {!selectedRepo ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Or paste a repository URL manually.</p>
                    <Input
                      id="project-repository"
                      type="url"
                      name="gitRepositoryUrl"
                      placeholder="https://github.com/org/repo"
                      value={gitRepositoryUrl}
                      onChange={(event) => setGitRepositoryUrl(event.target.value)}
                    />
                  </div>
                ) : (
                  <input type="hidden" name="gitRepositoryUrl" value={gitRepositoryUrl} />
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
                onChange={(event) => setGitRepositoryUrl(event.target.value)}
              />
            )}
          </div>

          <div className="rounded-2xl border bg-muted/20 p-4 text-xs leading-6 text-muted-foreground">
            New projects start with one public <span className="font-mono text-foreground">app</span> service.
            You can add more services and richer compositions after the project exists.
          </div>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        {nameError ? <p className="text-destructive">{nameError}</p> : null}
        {slugError ? <p className="text-destructive">{slugError}</p> : null}
        {urlError ? <p className="text-destructive">{urlError}</p> : null}
        {branchError ? <p className="text-destructive">{branchError}</p> : null}
      </div>

      <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">
          When you create the project, Vcloudrunner will save the repo, branch, and default service layout for you.
        </p>
        <FormSubmitButton idleText="Create Project" pendingText="Creating..." disabled={formInvalid} />
      </div>
    </form>
  );
}
