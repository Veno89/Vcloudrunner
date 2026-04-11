'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  closeLabel?: string;
  returnFocusRef?: RefObject<HTMLElement>;
  contentId?: string;
  role?: 'dialog' | 'alertdialog';
  closeOnOverlayClick?: boolean;
  overlayClassName?: string;
  contentClassName?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  closeLabel = 'Close dialog',
  returnFocusRef,
  contentId,
  role = 'dialog',
  closeOnOverlayClick = true,
  overlayClassName,
  contentClassName,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      if (!wasOpenRef.current) {
        return;
      }

      wasOpenRef.current = false;
      const focusTarget = returnFocusRef?.current ?? previouslyFocusedRef.current;
      focusTarget?.focus();
      return;
    }

    wasOpenRef.current = true;
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const preferredFocus = dialogRef.current?.querySelector<HTMLElement>('[data-autofocus="true"]');
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    (preferredFocus ?? firstFocusable ?? dialogRef.current)?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, returnFocusRef]);

  if (!open) {
    return null;
  }

  const closeDialog = () => onOpenChange(false);

  const onOverlayClick = () => {
    if (!closeOnOverlayClick) {
      return;
    }

    closeDialog();
  };

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={cn('fixed inset-0 z-50 flex items-center justify-center bg-slate-950/82 p-4 backdrop-blur-sm', overlayClassName)}
      onClick={onOverlayClick}
    >
      <div
        id={contentId}
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/95 p-5 text-foreground shadow-[0_28px_80px_rgba(2,6,23,0.55)]',
          contentClassName
        )}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={trapFocus}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-3 top-3 h-8 w-8 p-0 text-slate-300 hover:bg-white/10 hover:text-white"
          aria-label={closeLabel}
          onClick={closeDialog}
        >
          <X className="h-4 w-4" />
        </Button>
        <h2 id={titleId} className="pr-10 text-sm font-semibold text-white">{title}</h2>
        {description ? (
          <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        ) : null}
        {children}
        {actions ? <div className="mt-4 flex justify-end gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
