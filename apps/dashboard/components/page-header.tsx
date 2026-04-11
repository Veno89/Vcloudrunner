import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
        Dashboard workspace
      </p>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
        {description ? <p className="max-w-3xl text-sm leading-7 text-slate-400">{description}</p> : null}
      </div>
    </header>
  );
}
