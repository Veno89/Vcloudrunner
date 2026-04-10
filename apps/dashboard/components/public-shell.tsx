import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildDashboardRegisterHref,
  buildDashboardSignInHref
} from '@/lib/dashboard-auth-navigation';
import { cn } from '@/lib/utils';

interface PublicShellProps {
  children: ReactNode;
  className?: string;
}

export function PublicShell({ children, className }: PublicShellProps) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#08111f] text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.2),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(250,204,21,0.15),_transparent_26%),linear-gradient(180deg,_rgba(8,17,31,0.94),_rgba(4,8,16,1))]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(circle_at_center,black,transparent_78%)] opacity-35" />
      <div className="absolute left-[-10rem] top-20 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="absolute bottom-[-10rem] right-[-6rem] h-72 w-72 rounded-full bg-amber-300/15 blur-3xl" />

      <header className="relative z-10 border-b border-white/10 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-400/10 text-sky-200 shadow-[0_0_40px_rgba(56,189,248,0.12)]">
              <Box className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <p className="font-display text-lg font-semibold text-white">Vcloudrunner</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Self-hosted app platform</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <Link href="/#features" className="transition-colors hover:text-white">Features</Link>
            <Link href="/#workflow" className="transition-colors hover:text-white">How It Works</Link>
            <Link href="/#pricing" className="transition-colors hover:text-white">Pricing</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              className="text-slate-200 hover:bg-white/10 hover:text-white"
            >
              <Link href={buildDashboardSignInHref({ redirectTo: '/projects' })}>
                Sign In
              </Link>
            </Button>
            <Button
              asChild
              className="bg-sky-300 text-slate-950 hover:bg-sky-200"
            >
              <Link href={buildDashboardRegisterHref({ plan: 'free', redirectTo: '/projects' })}>
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className={cn('relative z-10 mx-auto max-w-6xl px-6 py-10 md:px-8 lg:py-14', className)}
      >
        {children}
      </main>
    </div>
  );
}
