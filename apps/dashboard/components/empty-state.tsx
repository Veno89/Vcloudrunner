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
    <Card>
      <CardHeader className="space-y-3">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-muted/30 text-muted-foreground">
          {icon ?? <Inbox className="h-4 w-4" aria-hidden />}
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}
