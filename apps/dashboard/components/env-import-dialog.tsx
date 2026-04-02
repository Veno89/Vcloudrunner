'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FormSubmitButton } from '@/components/form-submit-button';

interface EnvImportDialogProps {
  projectId: string;
  importAction: (formData: FormData) => Promise<void>;
}

export function EnvImportDialog({ projectId, importAction }: EnvImportDialogProps) {
  const [content, setContent] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        setContent(text);
      }
    };
    reader.readAsText(file);
  }

  if (!isOpen) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        Import .env
      </Button>
    );
  }

  const lineCount = content.split('\n').filter((l) => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith('#');
  }).length;

  return (
    <div className="rounded-md border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Import Environment Variables</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => { setIsOpen(false); setContent(''); }}
        >
          Cancel
        </Button>
      </div>

      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".env,.env.*,text/plain"
          onChange={handleFileChange}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
        />
        <p className="text-xs text-muted-foreground">
          Or paste contents directly:
        </p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={'# Comments are ignored\nKEY=value\nDATABASE_URL="postgres://..."'}
          rows={6}
          className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
        />
      </div>

      {content.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {lineCount} variable{lineCount !== 1 ? 's' : ''} detected. Existing keys will be overwritten.
        </p>
      )}

      <form action={importAction}>
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="content" value={content} />
        <FormSubmitButton
          idleText={`Import ${lineCount} variable${lineCount !== 1 ? 's' : ''}`}
          pendingText="Importing..."
          disabled={content.trim().length === 0}
          size="sm"
        />
      </form>
    </div>
  );
}
