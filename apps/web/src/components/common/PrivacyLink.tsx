interface PrivacyLinkProps {
  className?: string;
}

/** Deliberately quiet — small, light grey, opens in a new tab so it never interrupts a flow. */
export function PrivacyLink({ className = '' }: PrivacyLinkProps) {
  return (
    <a
      href="https://aiinnovisory.com/privacy"
      target="_blank"
      rel="noopener noreferrer"
      className={`text-xs text-ink-300 hover:text-ink-500 ${className}`}
    >
      Privacy Policy
    </a>
  );
}
