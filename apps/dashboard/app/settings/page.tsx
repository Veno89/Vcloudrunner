import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { PageLayout } from '@/components/page-layout';
import { SettingsSubnav } from '@/components/settings-subnav';

export default function SettingsPage() {
  return (
    <PageLayout>
      <PageHeader
        title="Settings"
        description="Manage account and platform-level configuration."
      />

      <SettingsSubnav active="overview" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Tokens</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Create, rotate, and revoke API tokens for programmatic access.
          </p>
          <Button asChild>
            <Link href="/settings/tokens">Open Tokens</Link>
          </Button>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
