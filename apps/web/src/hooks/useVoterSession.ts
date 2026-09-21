import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

export interface VoterSessionState {
  ready: boolean;
  error: Error | null;
}

/** Establishes (or reuses) the signed voter cookie for a poll before ballot interaction is enabled. */
export function useVoterSession(code: string): VoterSessionState {
  const [state, setState] = useState<VoterSessionState>({ ready: false, error: null });

  useEffect(() => {
    let active = true;
    setState({ ready: false, error: null });
    apiClient
      .establishSession(code)
      .then(() => {
        if (active) setState({ ready: true, error: null });
      })
      .catch((err: unknown) => {
        if (active) {
          setState({ ready: false, error: err instanceof Error ? err : new Error('Failed to establish session') });
        }
      });
    return () => {
      active = false;
    };
  }, [code]);

  return state;
}
