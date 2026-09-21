interface LastUpdatedIndicatorProps {
  lastUpdated: Date | null;
}

export function LastUpdatedIndicator({ lastUpdated }: LastUpdatedIndicatorProps) {
  if (!lastUpdated) return null;
  return (
    <p className="font-mono text-xs text-ink-300">
      Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </p>
  );
}
