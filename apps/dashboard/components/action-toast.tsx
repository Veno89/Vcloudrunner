'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

interface ActionToastProps {
  status?: 'success' | 'error';
  message?: string;
  fallbackErrorMessage?: string;
}

export function ActionToast({ status, message, fallbackErrorMessage = 'Operation failed.' }: ActionToastProps) {
  const hasShown = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (hasShown.current || !status) {
      return;
    }

    const resolvedMessage =
      typeof message === 'string' && message.length > 0
        ? decodeURIComponent(message)
        : status === 'success'
          ? 'Operation completed successfully.'
          : fallbackErrorMessage;

    if (status === 'success') {
      toast.success(resolvedMessage);
    } else {
      toast.error(resolvedMessage);
    }

    hasShown.current = true;

    const next = new URLSearchParams(searchParams.toString());
    next.delete('status');
    next.delete('message');
    next.delete('reason');

    const query = next.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [fallbackErrorMessage, message, pathname, router, searchParams, status]);

  return null;
}
