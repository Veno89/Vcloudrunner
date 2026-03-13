'use client';

import type { MouseEvent } from 'react';

interface ConfirmSubmitButtonProps {
  label: string;
  confirmMessage: string;
  className?: string;
}

export function ConfirmSubmitButton({ label, confirmMessage, className }: ConfirmSubmitButtonProps) {
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    const accepted = window.confirm(confirmMessage);
    if (!accepted) {
      event.preventDefault();
    }
  };

  return (
    <button type="submit" onClick={onClick} className={className}>
      {label}
    </button>
  );
}
