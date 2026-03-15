'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

interface MaskedSecretValueProps {
  value: string;
}

function maskSecret(value: string): string {
  if (value.length <= 4) {
    return '••••';
  }

  const visibleTail = value.slice(-4);
  return `${'•'.repeat(Math.min(Math.max(value.length - 4, 4), 24))}${visibleTail}`;
}

export function MaskedSecretValue({ value }: MaskedSecretValueProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const masked = useMemo(() => maskSecret(value), [value]);

  const onCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex items-center gap-2">
      <p className="font-mono text-xs text-muted-foreground">{revealed ? value : masked}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setRevealed((current) => !current)}
        className="h-6 px-2 text-[10px]"
      >
        {revealed ? 'Hide' : 'Reveal'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          void onCopy();
        }}
        className="h-6 px-2 text-[10px]"
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
