'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" onClick={onOverlayClick}>
      <div
        id={contentId}
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-lg border bg-card p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={trapFocus}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2 h-7 w-7 p-0"
          aria-label={closeLabel}
          onClick={closeDialog}
        >
          <X className="h-4 w-4" />
        </Button>
        <h2 id={titleId} className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p id={descriptionId} className="mt-2 text-sm text-foreground">{description}</p>
        ) : null}
        {children}
        {actions ? <div className="mt-4 flex justify-end gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
