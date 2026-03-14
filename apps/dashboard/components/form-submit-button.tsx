'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';

interface FormSubmitButtonProps extends Omit<ButtonProps, 'type'> {
  idleText: string;
  pendingText?: string;
}

export function FormSubmitButton({
  idleText,
  pendingText,
  disabled,
  ...buttonProps
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={disabled || pending} {...buttonProps}>
      {pending ? (pendingText ?? 'Working...') : idleText}
    </Button>
  );
}
