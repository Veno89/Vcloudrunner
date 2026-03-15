import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SettingsSubnavProps {
  active: 'overview' | 'tokens';
}

const items: Array<{ key: SettingsSubnavProps['active']; label: string; href: string }> = [
  { key: 'overview', label: 'Overview', href: '/settings' },
  { key: 'tokens', label: 'API Tokens', href: '/settings/tokens' },
];

export function SettingsSubnav({ active }: SettingsSubnavProps) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Settings navigation">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={cn(
            'rounded-md border px-3 py-1.5 text-sm transition-colors',
            active === item.key
              ? 'border-primary/60 bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground hover:bg-accent/40 hover:text-foreground'
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
