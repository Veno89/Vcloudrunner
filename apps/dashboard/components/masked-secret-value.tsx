'use client';

import { useMemo, useState } from 'react';

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
      <p className="text-xs text-slate-400">{revealed ? value : masked}</p>
      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
      >
        {revealed ? 'Hide' : 'Reveal'}
      </button>
      <button
        type="button"
        onClick={() => {
          void onCopy();
        }}
        className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
