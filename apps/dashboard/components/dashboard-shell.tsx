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
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="border-b px-6 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              {platformStatus}
              {sessionControls}
            </div>
          </div>
          <main id="main-content" className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
