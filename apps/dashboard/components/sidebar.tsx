'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Box, FolderGit2, Key, Layers, Menu, Rocket, ScrollText, Settings, ShieldCheck, User, X, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelpButton } from '@/components/onboarding/keyboard-shortcuts';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/projects', label: 'Projects', icon: FolderGit2, onboardingId: 'projects-link' },
  { href: '/deployments', label: 'Deployments', icon: Layers, onboardingId: 'deployments-link' },
  { href: '/environment', label: 'Environment', icon: Settings, onboardingId: 'env-link' },
  { href: '/logs', label: 'Logs', icon: ScrollText, onboardingId: 'logs-link' },
  { href: '/status', label: 'Status', icon: Activity, onboardingId: 'status-link' },
];

const settingsItems = [
  { href: '/settings', label: 'Overview', icon: Settings, onboardingId: 'settings-link' },
  { href: '/settings/account', label: 'Account', icon: User, onboardingId: 'account-link' },
  { href: '/settings/tokens', label: 'API Tokens', icon: Key, onboardingId: 'tokens-link' },
];

interface NavSectionProps {
  pathname: string;
  onNavigate?: () => void;
}

function NavSections({ pathname, onNavigate }: NavSectionProps) {
  return (
    <nav className="flex-1 space-y-6 px-3 py-4">
      <div className="space-y-2">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400/90">
          Workspace
        </p>
        {navItems.map(({ href, label, icon: Icon, onboardingId }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              data-onboarding={onboardingId}
              className={cn(
                'group flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-all duration-200',
                active
                  ? 'border-sky-300/20 bg-sky-400/12 text-white shadow-[0_12px_32px_rgba(14,165,233,0.12)]'
                  : 'border-white/5 bg-white/[0.03] text-slate-300 hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.07] hover:text-white'
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                  active
                    ? 'border-sky-300/25 bg-sky-400/18 text-sky-100'
                    : 'border-white/10 bg-slate-950/60 text-slate-400 group-hover:text-slate-100'
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400/90">
          Settings
        </p>
        {settingsItems.map(({ href, label, icon: Icon, onboardingId }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              data-onboarding={onboardingId}
              className={cn(
                'group flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-all duration-200',
                active
                  ? 'border-sky-300/20 bg-sky-400/12 text-white shadow-[0_12px_32px_rgba(14,165,233,0.12)]'
                  : 'border-white/5 bg-white/[0.03] text-slate-300 hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.07] hover:text-white'
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                  active
                    ? 'border-sky-300/25 bg-sky-400/18 text-sky-100'
                    : 'border-white/10 bg-slate-950/60 text-slate-400 group-hover:text-slate-100'
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </div>

      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300 shadow-[0_18px_40px_rgba(2,6,23,0.22)]">
        <div className="flex items-center gap-2 text-slate-100">
          <Rocket className="h-4 w-4 text-sky-300" />
          <p className="font-medium">Quick flow</p>
        </div>
        <p className="mt-2 text-xs leading-6 text-slate-400">
          Create a project, add environment variables, then trigger the first deploy from the same workspace.
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
            Guided help
          </div>
          <HelpButton />
        </div>
      </div>
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="fixed left-3 top-3 z-40 h-10 w-10 border-white/10 bg-slate-950/80 text-slate-100 shadow-[0_16px_48px_rgba(2,6,23,0.35)] backdrop-blur md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="h-4 w-4" />
      </Button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" aria-hidden={!mobileOpen}>
          <Button
            type="button"
            variant="ghost"
            className="absolute inset-0 h-full w-full rounded-none bg-slate-950/80 p-0 hover:bg-slate-950/80"
            aria-label="Close navigation menu overlay"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="glass-panel-strong relative z-10 flex h-full w-72 flex-col border-r border-white/10">
            <div className="flex min-h-[92px] items-start justify-between gap-3 border-b border-white/10 px-5 py-5">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/30 bg-sky-400/12 text-sky-100 shadow-[0_0_40px_rgba(56,189,248,0.12)]">
                    <Box className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-display text-base font-semibold tracking-tight text-white">Vcloudrunner</span>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Control surface</p>
                  </div>
                </div>
                <p className="text-xs leading-5 text-slate-400">
                  One place to ship, monitor, and tune your self-hosted apps.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <NavSections pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <aside className="glass-panel-strong hidden h-screen w-72 flex-col border-r border-white/10 md:flex">
        <div className="min-h-[124px] border-b border-white/10 px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] border border-sky-300/30 bg-sky-400/12 text-sky-100 shadow-[0_0_40px_rgba(56,189,248,0.12)]">
              <Box className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-semibold tracking-tight text-white">Vcloudrunner</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-slate-400">
                  ops
                </span>
              </div>
              <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
                Self-hosted app platform
              </p>
              <p className="max-w-[15rem] text-xs leading-5 text-slate-400">
                Deploy repositories, watch platform health, and manage access without bouncing between tools.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
            <Activity className="h-3.5 w-3.5 text-emerald-300" />
            <span>Operational view with live project actions</span>
            <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-slate-500" />
          </div>
        </div>
        <NavSections pathname={pathname} />
      </aside>
    </>
  );
}
