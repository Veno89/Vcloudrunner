import type { ReactNode } from 'react';

interface DemoModeBannerProps {
  children?: ReactNode;
}

export function DemoModeBanner({ children }: DemoModeBannerProps) {
  return (
    <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-foreground" role="status" aria-live="polite">
      <span className="font-medium">Demo mode:</span>{' '}
      {children ?? 'API data unavailable, showing sample data.'}
    </div>
  );
}
