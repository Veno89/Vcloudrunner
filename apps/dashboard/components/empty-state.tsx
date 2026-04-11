import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EmptyStateProps {
  title: string;
  description: string;
  actions?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, actions, icon }: EmptyStateProps) {
  return (
    <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
      <CardHeader className="space-y-4 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_48%),rgba(255,255,255,0.02)]">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/20 bg-sky-400/10 text-sky-100">
          {icon ?? <Inbox className="h-4 w-4" aria-hidden />}
        </div>
        <CardTitle className="font-display text-xl text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="max-w-2xl text-sm leading-7 text-slate-400">{description}</p>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}
