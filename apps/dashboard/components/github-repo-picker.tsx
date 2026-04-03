'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { GitHubInstallation, GitHubRepository } from '@/lib/api/github';

interface GitHubRepoPickerProps {
  installations: GitHubInstallation[];
  installUrl: string | null;
  onSelect: (repo: GitHubRepository, installationId: number) => void;
  onClear: () => void;
  selected: { fullName: string; installationId: number } | null;
}

export function GitHubRepoPicker({
  installations,
  installUrl,
  onSelect,
  onClear,
  selected
}: GitHubRepoPickerProps) {
  const [repos, setRepos] = useState<GitHubRepository[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeInstallation, setActiveInstallation] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const loadRepos = useCallback(async (installationId: number) => {
    setLoading(true);
    setError(null);
    setActiveInstallation(installationId);
    try {
      const response = await fetch(`/api/github/repos?installationId=${installationId}`);
      if (!response.ok) {
        throw new Error('Failed to load repositories');
      }
      const data = await response.json();
      setRepos(data.repos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repos');
      setRepos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (installations.length === 1 && !activeInstallation) {
      loadRepos(installations[0].installationId);
    }
  }, [installations, activeInstallation, loadRepos]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
        </svg>
        <span className="font-mono">{selected.fullName}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-6 px-2 text-xs"
          onClick={onClear}
        >
          Change
        </Button>
      </div>
    );
  }

  if (installations.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Connect your GitHub account to select repositories directly.
        </p>
        {installUrl ? (
          <a
            href={installUrl}
            className="inline-flex items-center gap-2 rounded-md border bg-[#24292f] px-3 py-2 text-sm font-medium text-white hover:bg-[#24292f]/90"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
            </svg>
            Connect GitHub
          </a>
        ) : null}
      </div>
    );
  }

  const filtered = repos.filter((repo) =>
    repo.fullName.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-2">
      {installations.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          {installations.map((inst) => (
            <Button
              key={inst.installationId}
              type="button"
              variant={activeInstallation === inst.installationId ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => loadRepos(inst.installationId)}
            >
              {inst.accountLogin}
            </Button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p className="py-2 text-xs text-muted-foreground">Loading repositories...</p>
      ) : error ? (
        <p className="py-2 text-xs text-destructive">{error}</p>
      ) : repos.length > 0 ? (
        <div className="space-y-1">
          <input
            type="text"
            placeholder="Search repos..."
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
          <div className="max-h-48 overflow-y-auto rounded-md border">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No repos match filter</p>
            ) : (
              filtered.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => onSelect(repo, activeInstallation!)}
                >
                  <span className="font-mono text-xs">{repo.fullName}</span>
                  {repo.private ? (
                    <span className="ml-auto text-[10px] text-muted-foreground">private</span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : activeInstallation ? (
        <p className="py-2 text-xs text-muted-foreground">No repositories found for this installation.</p>
      ) : null}

      {installUrl ? (
        <a
          href={installUrl}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          + Add another GitHub account/org
        </a>
      ) : null}
    </div>
  );
}
