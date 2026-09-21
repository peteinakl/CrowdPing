import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] bg-white p-6 [box-shadow:var(--shadow-card)] ${className}`}
      {...props}
    />
  );
}
