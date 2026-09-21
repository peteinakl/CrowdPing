import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import type { ParticipantResults } from '../lib/types';

const POLL_INTERVAL_MS = 2000;
const MAX_BACKOFF_MS = 30_000;

export interface ResultsPollingState {
  results: ParticipantResults | null;
  stale: boolean;
  lastUpdated: Date | null;
  error: Error | null;
}

/**
 * Fetches immediately, then every 2s while the tab is visible. Pauses on
 * hidden tabs and refreshes immediately on visibility restore, applies
 * jittered backoff on failure, discards out-of-order responses, and stops
 * permanently once a final result set is fetched (PRD §11).
 */
export function useResultsPolling(code: string, enabled: boolean): ResultsPollingState {
  const [state, setState] = useState<ResultsPollingState>({
    results: null,
    stale: false,
    lastUpdated: null,
    error: null,
  });

  const sequenceRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failureCountRef = useRef(0);
  const stoppedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const fetchOnce = useCallback(async () => {
    const mySequence = ++sequenceRef.current;
    try {
      const results = await apiClient.getResults(code);
      if (sequenceRef.current !== mySequence) return;

      failureCountRef.current = 0;
      setState({ results, stale: false, lastUpdated: new Date(), error: null });

      if (results.isFinal) {
        stoppedRef.current = true;
        return;
      }

      if (!stoppedRef.current && document.visibilityState === 'visible') {
        clearTimer();
        timeoutRef.current = setTimeout(fetchOnce, POLL_INTERVAL_MS);
      }
    } catch (err) {
      if (sequenceRef.current !== mySequence) return;

      failureCountRef.current += 1;
      setState((prev) => ({
        ...prev,
        stale: true,
        error: err instanceof Error ? err : new Error('Results request failed'),
      }));

      if (!stoppedRef.current && document.visibilityState === 'visible') {
        const backoff = Math.min(POLL_INTERVAL_MS * 2 ** failureCountRef.current, MAX_BACKOFF_MS);
        const jitter = backoff * (0.85 + Math.random() * 0.3);
        clearTimer();
        timeoutRef.current = setTimeout(fetchOnce, jitter);
      }
    }
  }, [code, clearTimer]);

  useEffect(() => {
    if (!enabled) return;

    stoppedRef.current = false;
    failureCountRef.current = 0;
    fetchOnce();

    const handleVisibility = () => {
      if (stoppedRef.current) return;
      if (document.visibilityState === 'visible') {
        clearTimer();
        fetchOnce();
      } else {
        clearTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimer();
    };
  }, [enabled, fetchOnce, clearTimer]);

  return state;
}
