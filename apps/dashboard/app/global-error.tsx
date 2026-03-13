'use client';

import { Card, CardContent } from '@/components/ui/card';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <Card className="max-w-md">
          <CardContent className="space-y-4 pt-6 text-center">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              {error.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={reset}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
          </CardContent>
        </Card>
      </body>
    </html>
  );
}
