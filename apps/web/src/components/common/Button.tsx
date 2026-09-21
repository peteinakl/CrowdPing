import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-accent-600 text-white [box-shadow:var(--shadow-raised)] hover:bg-accent-700 focus-visible:outline-accent-600',
  secondary: 'bg-ink-100 text-ink-950 hover:bg-ink-300/50 focus-visible:outline-ink-700',
  ghost: 'bg-transparent text-ink-700 hover:bg-ink-100 focus-visible:outline-ink-700',
  danger: 'bg-red-600 text-white [box-shadow:var(--shadow-raised)] hover:bg-red-700 focus-visible:outline-red-600',
};

const SIZE_CLASSES: Record<Size, string> = {
  md: 'min-h-12 px-5 text-base',
  lg: 'min-h-14 px-7 text-lg',
};

/**
 * Shared visual style, exposed so non-<button> elements (e.g. a Link CTA) can match. The
 * press-scale is a tiny, purposeful motion cue (spring easing, reduced-motion-safe) rather than
 * a flat colour swap alone — one of the "tiny interaction details that read as expensive"
 * rather than templated.
 */
export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className = ''): string {
  return `inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold tracking-tight transition-[background-color,transform,box-shadow] duration-150 motion-safe:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', ...props },
  ref,
) {
  return <button ref={ref} className={buttonClasses(variant, size, className)} {...props} />;
});
