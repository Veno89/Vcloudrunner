import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-5xl items-center justify-center py-20">
      <Card className="max-w-md">
        <CardContent className="space-y-4 pt-6 text-center">
          <h2 className="text-lg font-semibold">Page Not Found</h2>
          <p className="text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/projects"
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to Projects
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
