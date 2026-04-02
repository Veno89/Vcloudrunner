import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionToast } from '@/components/action-toast';
import { FormSubmitButton } from '@/components/form-submit-button';
import { PageHeader } from '@/components/page-header';
import { PageLayout } from '@/components/page-layout';
import { normalizeDashboardRedirectTarget } from '@/lib/dashboard-auth-navigation';
import { registerAction } from './actions';

interface RegisterPageProps {
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
    redirectTo?: string;
  };
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const redirectTo = normalizeDashboardRedirectTarget(searchParams?.redirectTo);

  return (
    <PageLayout className="max-w-lg">
      <PageHeader
        title="Create Account"
        description="Register to start deploying with Vcloudrunner."
      />

      <ActionToast
        status={searchParams?.status}
        message={searchParams?.message}
        fallbackErrorMessage="Registration failed."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Register</CardTitle>
          <CardDescription>
            Already have an account? <Link href="/sign-in" className="underline underline-offset-2">Sign in</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={registerAction} className="space-y-4">
            <input type="hidden" name="redirectTo" value={redirectTo} readOnly />
            <div className="space-y-2">
              <Label htmlFor="register-name">Name</Label>
              <Input
                id="register-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                required
                maxLength={128}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-email">Email</Label>
              <Input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">Password</Label>
              <Input
                id="register-password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-confirm-password">Confirm Password</Label>
              <Input
                id="register-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter password"
                required
                minLength={8}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FormSubmitButton
                idleText="Create Account"
                pendingText="Creating account..."
              />
              <Button asChild variant="outline">
                <Link href="/sign-in">Sign In Instead</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
