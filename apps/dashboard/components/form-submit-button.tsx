'use client';

import { Loader2 } from 'lucide-react';
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
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {pendingText ?? 'Working...'}
        </>
      ) : idleText}
    </Button>
  );
}
