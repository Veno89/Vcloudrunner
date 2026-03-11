'use client';

import { useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';

function slugifyProjectName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

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

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Creating…' : 'Create Project'}
    </button>
  );
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
    <form action={action} className="mb-4 grid gap-2 rounded-lg border border-slate-800 bg-slate-900 p-3 md:grid-cols-[1fr_1fr_160px_auto]">
      <input
        type="text"
        name="name"
        placeholder="Project name"
        minLength={3}
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
      />
      <input
        type="url"
        name="gitRepositoryUrl"
        placeholder="https://github.com/org/repo"
        required
        value={gitRepositoryUrl}
        onChange={(event) => setGitRepositoryUrl(event.target.value)}
        className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
      />
      <input
        type="text"
        name="defaultBranch"
        placeholder="main"
        value={defaultBranch}
        onChange={(event) => setDefaultBranch(event.target.value)}
        className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
      />
      <SubmitButton disabled={formInvalid} />
      <div className="md:col-span-4 space-y-1 text-xs text-slate-500">
        <p>Slug preview: <span className="font-mono text-slate-400">{slug || '(empty)'}</span></p>
        <p>Slugs are derived from project name (lowercase + hyphens) and must be globally unique.</p>
        {nameError ? <p className="text-rose-300">{nameError}</p> : null}
        {slugError ? <p className="text-rose-300">{slugError}</p> : null}
        {urlError ? <p className="text-rose-300">{urlError}</p> : null}
        {branchError ? <p className="text-rose-300">{branchError}</p> : null}
      </div>
    </form>
  );
}
