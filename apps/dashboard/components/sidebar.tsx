'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Layers, Key, Settings, FolderGit2, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/projects', label: 'Projects', icon: FolderGit2 },
  { href: '/deployments', label: 'Deployments', icon: Layers },
  { href: '/tokens', label: 'API Tokens', icon: Key },
  { href: '/environment', label: 'Environment', icon: Settings },
  { href: '/logs', label: 'Logs', icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Box className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight">Vcloudrunner</span>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
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
      </nav>
    </aside>
  );
}
