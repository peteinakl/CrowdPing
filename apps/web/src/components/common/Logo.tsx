interface LogoProps {
  className?: string;
}

export function Logo({ className = 'h-8 w-auto' }: LogoProps) {
  return <img src="/brand/crowdping-logo.svg" alt="CrowdPing" className={className} />;
}
