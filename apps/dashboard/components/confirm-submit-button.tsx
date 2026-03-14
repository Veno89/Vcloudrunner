'use client';

import type { MouseEvent } from 'react';
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
  ...buttonProps
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) {
      return;
    }

    const accepted = window.confirm(confirmMessage);
    if (!accepted) {
      event.preventDefault();
    }
  };

  return (
    <Button type="submit" onClick={onClick} disabled={pending} {...buttonProps}>
      {pending ? (pendingLabel ?? 'Working...') : label}
    </Button>
  );
}
