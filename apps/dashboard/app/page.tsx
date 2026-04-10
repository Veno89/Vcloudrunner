import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Boxes,
  Database,
  GitBranch,
  Globe,
  Rocket,
  ShieldCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PublicShell } from '@/components/public-shell';
import {
  buildDashboardRegisterHref,
  buildDashboardSignInHref
} from '@/lib/dashboard-auth-navigation';
import { getDashboardSessionToken } from '@/lib/dashboard-session';

const features = [
  {
    title: 'Git repo to live URL',
    description: 'Connect a repository, build it in Docker, and publish it behind your own Vcloudrunner domain.',
    icon: GitBranch
  },
  {
    title: 'One place for ops',
    description: 'Manage deployments, environment variables, logs, domains, and health checks from a single workspace.',
    icon: Boxes
  },
  {
    title: 'Database-aware projects',
    description: 'Wire external databases into your apps and keep project-level configuration out of the cloned repo.',
    icon: Database
  }
];

const workflow = [
  {
    step: '01',
    title: 'Create your account',
    description: 'Start on the Free plan today and get a real account stored in the platform database.'
  },
  {
    step: '02',
    title: 'Connect a project',
    description: 'Point Vcloudrunner at a Git repository, add environment variables, and define the runtime shape.'
  },
  {
    step: '03',
    title: 'Ship from one control room',
    description: 'Watch builds, deployments, logs, and domains from the same dashboard your team will use every day.'
  }
];

const pricing = [
  {
    name: 'Free',
    price: '$0',
    summary: 'Live today',
    description: 'Create an account, connect a repo, and start deploying on your own node.',
    ctaLabel: 'Create Free Account',
    ctaHref: buildDashboardRegisterHref({ plan: 'free', redirectTo: '/projects' }),
    variant: 'live' as const
  },
  {
    name: 'Pro',
    price: 'Soon',
    summary: 'Placeholder for billing',
    description: 'Seats, richer collaboration, and commercial features are being shaped next.',
    ctaLabel: 'Explore Pro',
    ctaHref: buildDashboardRegisterHref({ plan: 'pro', redirectTo: '/projects' }),
    variant: 'soon' as const
  }
];

export default function HomePage() {
  const hasSession = Boolean(getDashboardSessionToken() || process.env.NEXT_PUBLIC_DEMO_USER_ID?.trim());

  if (hasSession) {
    redirect('/projects');
  }

  return (
    <PublicShell>
      <section className="grid gap-10 pb-16 pt-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-24">
        <div className="space-y-7">
          <Badge variant="info" className="border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sky-100">
            Local-first deployments, real operator workflow
          </Badge>
          <div className="space-y-4">
            <h1 className="font-display text-5xl font-semibold leading-[0.95] text-white sm:text-6xl lg:text-7xl">
              Ship self-hosted apps like they belong on a platform.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              Vcloudrunner turns a Git repo into a running app with builds, logs, environments,
              domains, and project settings collected in one calm control room.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-sky-300 text-slate-950 hover:bg-sky-200">
              <Link href={buildDashboardRegisterHref({ plan: 'free', redirectTo: '/projects' })}>
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href={buildDashboardSignInHref({ redirectTo: '/projects' })}>
                Sign In
              </Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Deploy from Git</p>
              <p className="pt-2 text-sm text-slate-200">Build images and push updates without leaving the dashboard.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Manage runtime config</p>
              <p className="pt-2 text-sm text-slate-200">Project-scoped environment values stay outside the cloned repository.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Own the surface</p>
              <p className="pt-2 text-sm text-slate-200">Serve apps on your own machine, your own domains, and your own rules.</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 translate-x-4 translate-y-6 rounded-[2rem] bg-gradient-to-br from-sky-400/20 to-amber-300/10 blur-2xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 shadow-[0_30px_80px_rgba(2,8,23,0.65)] backdrop-blur">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              workspace preview
            </div>
            <div className="mt-6 grid gap-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Project</p>
                    <p className="font-display pt-1 text-3xl text-white">venos-workshop</p>
                  </div>
                  <Badge variant="success" className="bg-emerald-500/15 text-emerald-100">
                    running
                  </Badge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Route</p>
                    <p className="pt-2 text-sm text-slate-200">apps.127.0.0.1.nip.io</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Build</p>
                    <p className="pt-2 text-sm text-slate-200">Dockerized from Git</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Data</p>
                    <p className="pt-2 text-sm text-slate-200">External MongoDB linked</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5">
                <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
                  <span className="font-mono text-sky-100">git push origin main</span>
                  <Badge variant="outline" className="border-sky-400/25 bg-sky-400/10 text-sky-100">
                    watched
                  </Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    ['Clone repository', 'completed'],
                    ['Build service image', 'completed'],
                    ['Attach domains + env', 'completed'],
                    ['Promote deployment', 'live']
                  ].map(([label, state]) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <span className="text-sm text-slate-200">{label}</span>
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{state}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="space-y-5 py-10">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm uppercase tracking-[0.24em] text-sky-200">Why teams use it</p>
          <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl">
            The platform layer your local infrastructure has been missing.
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {features.map(({ title, description, icon: Icon }) => (
            <Card key={title} className="border-white/10 bg-white/[0.04] shadow-none backdrop-blur">
              <CardContent className="space-y-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-100">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-2xl text-white">{title}</h3>
                  <p className="text-sm leading-7 text-slate-300">{description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="workflow" className="grid gap-4 py-10 lg:grid-cols-3">
        {workflow.map(({ step, title, description }) => (
          <div key={step} className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-6 backdrop-blur">
            <p className="text-sm uppercase tracking-[0.24em] text-amber-200">{step}</p>
            <h3 className="font-display pt-4 text-2xl text-white">{title}</h3>
            <p className="pt-3 text-sm leading-7 text-slate-300">{description}</p>
          </div>
        ))}
      </section>

      <section id="pricing" className="space-y-6 py-10">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm uppercase tracking-[0.24em] text-sky-200">Plans</p>
          <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl">
            Start free today, then grow into Pro when billing lands.
          </h2>
          <p className="text-base leading-8 text-slate-300">
            Free signups are live now and create a real account. Pro is intentionally shown as a
            placeholder while payments and provisioning are wired in.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {pricing.map((plan) => (
            <div
              key={plan.name}
              className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-3xl text-white">{plan.name}</p>
                  <p className="pt-2 text-sm text-slate-400">{plan.summary}</p>
                </div>
                <Badge
                  variant={plan.variant === 'live' ? 'success' : 'warning'}
                  className={plan.variant === 'live' ? 'bg-emerald-500/15 text-emerald-100' : 'bg-amber-400/15 text-amber-50'}
                >
                  {plan.variant === 'live' ? 'Ready' : 'Placeholder'}
                </Badge>
              </div>
              <p className="font-display pt-8 text-5xl text-white">{plan.price}</p>
              <p className="pt-4 text-sm leading-7 text-slate-300">{plan.description}</p>
              <div className="mt-6 space-y-3 text-sm text-slate-200">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-sky-200" />
                  <span>Per-user dashboard sessions instead of repo-stored secrets.</span>
                </div>
                <div className="flex items-start gap-3">
                  <Globe className="mt-0.5 h-4 w-4 text-sky-200" />
                  <span>Deployment URLs, environment management, logs, and project controls in one place.</span>
                </div>
                <div className="flex items-start gap-3">
                  <Rocket className="mt-0.5 h-4 w-4 text-sky-200" />
                  <span>{plan.variant === 'live' ? 'You can create this account right now.' : 'You can preview the Pro path today; checkout comes next.'}</span>
                </div>
              </div>
              <Button
                asChild
                size="lg"
                className={plan.variant === 'live' ? 'mt-8 bg-sky-300 text-slate-950 hover:bg-sky-200' : 'mt-8 bg-white/10 text-white hover:bg-white/15'}
              >
                <Link href={plan.ctaHref}>
                  {plan.ctaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
