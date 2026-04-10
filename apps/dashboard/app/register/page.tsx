import Link from 'next/link';
import { ArrowRight, CheckCircle2, Crown, Sparkles } from 'lucide-react';
import { ActionToast } from '@/components/action-toast';
import { PublicShell } from '@/components/public-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormSubmitButton } from '@/components/form-submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  buildDashboardRegisterHref,
  buildDashboardSignInHref,
  normalizeDashboardPlan,
  normalizeDashboardRedirectTarget
} from '@/lib/dashboard-auth-navigation';
import { cn } from '@/lib/utils';
import { registerAction } from './actions';

interface RegisterPageProps {
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
    redirectTo?: string;
    plan?: 'free' | 'pro';
  };
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const redirectTo = normalizeDashboardRedirectTarget(searchParams?.redirectTo);
  const plan = normalizeDashboardPlan(searchParams?.plan);
  const isFreePlan = plan === 'free';
  const planHref = (nextPlan: 'free' | 'pro') =>
    buildDashboardRegisterHref({ plan: nextPlan, redirectTo });
  const signInHref = buildDashboardSignInHref({ redirectTo });
  const includedToday = [
    'A real account stored in the platform database',
    'Session-based sign-in for the dashboard',
    'Projects, deployments, logs, environment variables, and domains',
    'The same workspace you have been testing after login'
  ];

  return (
    <PublicShell className="max-w-6xl">
      <ActionToast
        status={searchParams?.status}
        message={searchParams?.message}
        fallbackErrorMessage="Registration failed."
      />

      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-6">
          <Badge
            variant={isFreePlan ? 'success' : 'warning'}
            className={isFreePlan ? 'bg-emerald-500/15 text-emerald-100' : 'bg-amber-400/15 text-amber-50'}
          >
            {isFreePlan ? 'Free plan is live now' : 'Pro is still a placeholder'}
          </Badge>

          <div className="space-y-4">
            <h1 className="font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Create your Vcloudrunner account and pick the path that fits today.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-300">
              Free creates a real account right now and sends you into the dashboard you have been
              testing. Pro is visible so the upgrade path is clear, but billing and provisioning come later.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href={planHref('free')}
              className={cn(
                'rounded-[1.5rem] border p-5 transition-all',
                isFreePlan
                  ? 'border-sky-300/40 bg-sky-400/10 shadow-[0_0_40px_rgba(56,189,248,0.12)]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-2xl text-white">Free</p>
                  <p className="pt-1 text-sm text-slate-400">Live today</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              </div>
              <p className="pt-4 text-sm leading-7 text-slate-300">
                Start with real auth, real projects, and the current workspace.
              </p>
            </Link>

            <Link
              href={planHref('pro')}
              className={cn(
                'rounded-[1.5rem] border p-5 transition-all',
                !isFreePlan
                  ? 'border-amber-300/35 bg-amber-300/10 shadow-[0_0_40px_rgba(251,191,36,0.1)]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-2xl text-white">Pro</p>
                  <p className="pt-1 text-sm text-slate-400">Coming soon</p>
                </div>
                <Crown className="h-5 w-5 text-amber-200" />
              </div>
              <p className="pt-4 text-sm leading-7 text-slate-300">
                Placeholder for paid features, team workflows, and future billing.
              </p>
            </Link>
          </div>

          {isFreePlan ? (
            <Card className="border-white/10 bg-slate-950/75 shadow-[0_30px_80px_rgba(2,8,23,0.4)] backdrop-blur">
              <CardHeader>
                <CardTitle className="text-xl text-white">Create your Free account</CardTitle>
                <CardDescription>
                  Already have an account?{' '}
                  <Link href={signInHref} className="underline underline-offset-2">
                    Sign in
                  </Link>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={registerAction} className="space-y-4">
                  <input type="hidden" name="redirectTo" value={redirectTo} readOnly />
                  <input type="hidden" name="plan" value={plan} readOnly />
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
                      className="border-white/10 bg-white/[0.03]"
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
                      className="border-white/10 bg-white/[0.03]"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
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
                        className="border-white/10 bg-white/[0.03]"
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
                        className="border-white/10 bg-white/[0.03]"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FormSubmitButton
                      idleText="Create Free Account"
                      pendingText="Creating account..."
                      className="bg-sky-300 text-slate-950 hover:bg-sky-200"
                    />
                    <Button
                      asChild
                      variant="outline"
                      className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                    >
                      <Link href={signInHref}>Sign In Instead</Link>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-amber-300/20 bg-slate-950/75 shadow-[0_30px_80px_rgba(2,8,23,0.4)] backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-white">
                  <Sparkles className="h-5 w-5 text-amber-200" />
                  Pro is visible, but not purchasable yet
                </CardTitle>
                <CardDescription>
                  We have not wired payments or Pro provisioning in yet, so this selection is a clear placeholder for now.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm leading-7 text-slate-300">
                  If you want to start using the dashboard today, create a Free account now and we can add
                  upgrade mechanics once billing is ready.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="bg-sky-300 text-slate-950 hover:bg-sky-200">
                    <Link href={planHref('free')}>
                      Switch to Free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  >
                    <Link href={signInHref}>I already have an account</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <aside className="space-y-4">
          <Card className="border-white/10 bg-white/[0.04] shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl text-white">What you get right after signup</CardTitle>
              <CardDescription>
                Free is the real path today, and it drops you into the existing workspace after account creation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {includedToday.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <p className="text-sm leading-6 text-slate-200">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.04] shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl text-white">Why show Pro already?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-slate-300">
              <p>
                So the product story is honest: there is a free path you can use now, and there is a future paid path
                we can layer in without redesigning the entry experience later.
              </p>
              <p>
                Once billing is wired in, this same screen can graduate from placeholder state into a real upgrade flow.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PublicShell>
  );
}
