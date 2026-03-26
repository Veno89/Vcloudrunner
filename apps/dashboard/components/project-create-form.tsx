'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormSubmitButton } from '@/components/form-submit-button';
import { slugifyProjectName } from '@/lib/helpers';

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
}

export function ProjectCreateForm({ action }: ProjectCreateFormProps) {
  const [name, setName] = useState('');
  const [gitRepositoryUrl, setGitRepositoryUrl] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');

  const slug = useMemo(() => slugifyProjectName(name), [name]);
  const nameError = name.trim().length < 3 ? 'Project name must be at least 3 characters.' : null;
  const slugError = slug.length < 3 ? 'Project slug must contain at least 3 valid characters.' : null;
  const urlError = gitRepositoryUrl.length > 0 && !isValidGitUrl(gitRepositoryUrl)
    ? 'Repository URL must be a valid http/https URL.'
    : null;
  const branchError = branchValidationMessage(defaultBranch.trim());

  const formInvalid = Boolean(nameError || slugError || urlError || branchError || gitRepositoryUrl.trim().length === 0);

  return (
    <form action={action} className="grid gap-2 rounded-lg border bg-card p-3 md:grid-cols-[1fr_1fr_160px_auto]">
      <Label htmlFor="project-name" className="sr-only">Project name</Label>
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
      <Label htmlFor="project-repository" className="sr-only">Repository URL</Label>
      <Input
        id="project-repository"
        type="url"
        name="gitRepositoryUrl"
        placeholder="https://github.com/org/repo"
        required
        value={gitRepositoryUrl}
        onChange={(event) => setGitRepositoryUrl(event.target.value)}
      />
      <Label htmlFor="project-branch" className="sr-only">Default branch</Label>
      <Input
        id="project-branch"
        type="text"
        name="defaultBranch"
        placeholder="main"
        value={defaultBranch}
        onChange={(event) => setDefaultBranch(event.target.value)}
      />
      <FormSubmitButton idleText="Create Project" pendingText="Creating..." disabled={formInvalid} />
      <div className="space-y-1 text-xs text-muted-foreground md:col-span-4">
        <p>
          Slug preview: <span className="font-mono text-foreground">{slug || '(empty)'}</span>
        </p>
        <p>Slugs are derived from project name (lowercase + hyphens) and must be globally unique.</p>
        <p>New projects start with one public <span className="font-mono text-foreground">app</span> service and can grow into multi-service compositions later.</p>
        {nameError ? <p className="text-destructive">{nameError}</p> : null}
        {slugError ? <p className="text-destructive">{slugError}</p> : null}
        {urlError ? <p className="text-destructive">{urlError}</p> : null}
        {branchError ? <p className="text-destructive">{branchError}</p> : null}
      </div>
    </form>
  );
}
