'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';

interface ConfirmSubmitButtonProps extends Omit<ButtonProps, 'type' | 'onClick' | 'children'> {
  label: string;
  confirmMessage: string;
  pendingLabel?: string;
}

export function ConfirmSubmitButton({
  label,
  confirmMessage,
  pendingLabel,
  variant,
  size,
  className,
  ...buttonProps
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      triggerRef.current?.focus();
    }
  }, [open]);

  const openDialog = () => {
    if (pending) {
      return;
    }

    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
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

  const onConfirm = () => {
    const form = triggerRef.current?.form;
    if (!form) {
      closeDialog();
      return;
    }

    closeDialog();
    form.requestSubmit();
  };

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        disabled={pending}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        variant={variant}
        size={size}
        className={className}
        {...buttonProps}
      >
        {pending ? (pendingLabel ?? 'Working...') : label}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          onClick={closeDialog}
        >
          <div
            id={dialogId}
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="w-full max-w-md rounded-lg border bg-card p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={trapFocus}
          >
            <h2 id={titleId} className="text-sm font-semibold text-foreground">
              Please confirm
            </h2>
            <p id={descriptionId} className="mt-2 text-sm text-foreground">{confirmMessage}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button ref={cancelRef} type="button" variant="secondary" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="button" variant={variant ?? 'destructive'} onClick={onConfirm}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
