import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { Sidebar } from '@/components/sidebar';
import { PlatformStatus } from '@/components/platform-status';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'Vcloudrunner Dashboard',
  description: 'Single-node PaaS control dashboard',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex h-screen overflow-hidden">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="border-b px-6 py-3">
            <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-muted" />}>
              <PlatformStatus />
            </Suspense>
          </div>
          <main id="main-content" className="flex-1 p-6">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
