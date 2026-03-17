import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';

interface LiveDataUnavailableStateProps {
  description: string;
  title?: string;
  actionHref?: string;
  actionLabel?: string;
}

export function LiveDataUnavailableState({
  description,
  title = 'Live data unavailable',
  actionHref = '/projects',
  actionLabel = 'Open Projects'
}: LiveDataUnavailableStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      actions={(
        <Button asChild variant="outline" size="sm">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    />
  );
}
