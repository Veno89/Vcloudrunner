'use client';

import { useId, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

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
  const dialogId = useId();
  const onConfirm = () => {
    const form = triggerRef.current?.form;
    if (!form) {
      setOpen(false);
      return;
    }

    setOpen(false);
    form.requestSubmit();
  };

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
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

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Please confirm"
        description={confirmMessage}
        returnFocusRef={triggerRef}
        contentId={dialogId}
        role="alertdialog"
        closeOnOverlayClick={false}
        actions={(
          <>
            <Button type="button" variant="secondary" data-autofocus="true" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant={variant ?? 'destructive'} onClick={onConfirm}>
              Confirm
            </Button>
          </>
        )}
      />
    </>
  );
}
