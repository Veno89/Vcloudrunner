'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface ProjectSubnavProps {
  projectId: string;
}

export function ProjectSubnav({ projectId }: ProjectSubnavProps) {
  const pathname = usePathname();

  const items = [
    { href: `/projects/${projectId}`, label: 'Overview' },
    { href: `/projects/${projectId}/deployments`, label: 'Deployments' },
    { href: `/projects/${projectId}/environment`, label: 'Environment' },
    { href: `/projects/${projectId}/logs`, label: 'Logs' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active =
          item.href === `/projects/${projectId}`
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Button key={item.href} asChild size="sm" variant={active ? 'default' : 'outline'}>
            <Link href={item.href}>{item.label}</Link>
          </Button>
        );
      })}
    </div>
  );
}
