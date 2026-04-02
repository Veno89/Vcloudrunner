'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Layers, Settings, FolderGit2, ScrollText, Key, Activity, Menu, User, X } from 'lucide-react';
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
    <nav className="flex-1 space-y-4 px-2 py-3">
      <div className="space-y-1">
        {navItems.map(({ href, label, icon: Icon, onboardingId }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              data-onboarding={onboardingId}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="space-y-1">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
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
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="border-t px-2 py-2">
        <HelpButton />
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
        className="fixed left-3 top-3 z-40 h-9 w-9 md:hidden"
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
            className="absolute inset-0 h-full w-full rounded-none bg-background/80 p-0 hover:bg-background/80"
            aria-label="Close navigation menu overlay"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-64 flex-col border-r bg-card">
            <div className="flex h-14 items-center justify-between gap-2 border-b px-4">
              <div className="flex items-center gap-2">
                <Box className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold tracking-tight">Vcloudrunner</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
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

      <aside className="hidden h-screen w-56 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Box className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold tracking-tight">Vcloudrunner</span>
        </div>
        <NavSections pathname={pathname} />
      </aside>
    </>
  );
}
