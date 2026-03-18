import type { ReactNode } from 'react';

interface DemoModeBannerProps {
  children?: ReactNode;
  detail?: string | null;
}

export function DemoModeBanner({ children, detail }: DemoModeBannerProps) {
  return (
    <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-foreground" role="status" aria-live="polite">
      <p>
        <span className="font-medium">Demo mode:</span>{' '}
        {children ?? 'Live data unavailable, showing sample data.'}
      </p>
      {detail ? (
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}
