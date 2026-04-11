'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';

interface DashboardShellProps {
  children: ReactNode;
  platformStatus: ReactNode;
  sessionControls: ReactNode;
}

const PUBLIC_EXACT_PATHS = new Set([
  '/',
  '/sign-in',
  '/register'
]);

const PUBLIC_PREFIX_PATHS = [
  '/invitations'
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(pathname)) {
    return true;
  }

  return PUBLIC_PREFIX_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function DashboardShell({
  children,
  platformStatus,
  sessionControls
}: DashboardShellProps) {
  const pathname = usePathname();

  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="relative min-h-screen overflow-hidden bg-[#07101d] text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(250,204,21,0.12),_transparent_22%),linear-gradient(180deg,_rgba(7,16,29,0.98),_rgba(5,9,19,1))]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(circle_at_center,black,transparent_82%)] opacity-20" />
        <div className="pointer-events-none absolute left-[-12rem] top-20 h-96 w-96 rounded-full bg-sky-500/14 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-8rem] right-[-5rem] h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />

        <div className="relative z-10 flex min-h-screen">
        <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
            <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/45 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              {platformStatus}
              {sessionControls}
            </div>
          </div>
            <main id="main-content" className="relative flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {children}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
