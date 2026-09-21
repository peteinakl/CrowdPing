import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import type { MyVote } from '../lib/types';

export interface MyVoteState {
  vote: MyVote | null;
  setVote: (vote: MyVote | null) => void;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useMyVote(code: string, enabled: boolean): MyVoteState {
  const [vote, setVote] = useState<MyVote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const result = await apiClient.getMyVote(code);
      setVote(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load your saved answer'));
    }
  }, [code, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    apiClient
      .getMyVote(code)
      .then((result) => {
        if (active) {
          setVote(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err : new Error('Failed to load your saved answer'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code, enabled]);

  return { vote, setVote, loading, error, refresh };
}
