import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex flex-wrap items-center gap-2 rounded-md border bg-card/40 p-1', className)}
      {...props}
    />
  );
}

const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      active: {
        true: 'bg-primary text-primary-foreground shadow-sm',
        false: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      }
    },
    defaultVariants: {
      active: false
    }
  }
);

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tabsTriggerVariants> {
  asChild?: boolean;
}

export function TabsTrigger({ className, active, asChild = false, ...props }: TabsTriggerProps) {
  const Comp = asChild ? Slot : 'button';

  return <Comp className={cn(tabsTriggerVariants({ active, className }))} {...props} />;
}
