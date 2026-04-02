'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProjectSubnavProps {
  projectId: string;
}

export function ProjectSubnav({ projectId }: ProjectSubnavProps) {
  const pathname = usePathname();

  const items = [
    { href: `/projects/${projectId}`, label: 'Overview' },
    { href: `/projects/${projectId}/databases`, label: 'Databases' },
    { href: `/projects/${projectId}/domains`, label: 'Domains' },
    { href: `/projects/${projectId}/deployments`, label: 'Deployments' },
    { href: `/projects/${projectId}/environment`, label: 'Environment' },
    { href: `/projects/${projectId}/logs`, label: 'Logs' },
    { href: `/projects/${projectId}/settings`, label: 'Settings' },
  ];

  return (
    <TabsList className="w-full justify-start" data-onboarding="project-subnav">
      {items.map((item) => {
        const active =
          item.href === `/projects/${projectId}`
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <TabsTrigger key={item.href} asChild active={active}>
            <Link href={item.href}>{item.label}</Link>
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
