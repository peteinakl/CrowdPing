interface LiveRegionProps {
  message: string;
  assertive?: boolean;
}

/**
 * Announces vote-submit outcomes only — never wired to the 2-second results
 * poll tick (PRD §5: "without repeatedly announcing every chart update").
 */
export function LiveRegion({ message, assertive = false }: LiveRegionProps) {
  return (
    <div role={assertive ? 'alert' : 'status'} aria-live={assertive ? 'assertive' : 'polite'} className="sr-only">
      {message}
    </div>
  );
}
