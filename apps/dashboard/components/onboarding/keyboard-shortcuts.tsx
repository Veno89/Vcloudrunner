'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { HelpCircle, X, Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { keys: ['?'], description: 'Toggle this help panel' },
  { keys: ['g', 'p'], description: 'Go to Projects' },
  { keys: ['g', 'd'], description: 'Go to Deployments' },
  { keys: ['g', 's'], description: 'Go to Settings' },
  { keys: ['g', 't'], description: 'Go to Status' },
];

export function KeyboardShortcuts() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const router = useRouter();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      if (key === '?' || (key === '/' && e.shiftKey)) {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
        setPendingKey(null);
        return;
      }

      if (key === 'escape') {
        setHelpOpen(false);
        setPendingKey(null);
        return;
      }

      // Two-key combos: g + second key
      if (pendingKey === 'g') {
        setPendingKey(null);
        switch (key) {
          case 'p':
            e.preventDefault();
            router.push('/projects');
            return;
          case 'd':
            e.preventDefault();
            router.push('/deployments');
            return;
          case 's':
            e.preventDefault();
            router.push('/settings');
            return;
          case 't':
            e.preventDefault();
            router.push('/status');
            return;
        }
        return;
      }

      if (key === 'g') {
        setPendingKey('g');
        // Clear pending after 1 second
        setTimeout(() => setPendingKey(null), 1000);
        return;
      }
    },
    [pendingKey, router]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!helpOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg border bg-background p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(false)}
            className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-2">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.description}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((k, i) => (
                  <span key={i}>
                    {i > 0 && <span className="mx-0.5 text-muted-foreground">then</span>}
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {k}
                    </kbd>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Press <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-xs">?</kbd> to toggle this panel.
        </p>
      </div>
    </div>
  );
}

export function HelpButton() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        data-onboarding="help-button"
      >
        <HelpCircle className="h-4 w-4" />
        <span>Help & Shortcuts</span>
      </button>
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg border bg-background p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2">
              {SHORTCUTS.map((shortcut) => (
                <li
                  key={shortcut.description}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{shortcut.description}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((k, i) => (
                      <span key={i}>
                        {i > 0 && <span className="mx-0.5 text-muted-foreground">then</span>}
                        <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {k}
                        </kbd>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Press <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-xs">?</kbd> to toggle this panel.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
