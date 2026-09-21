import type {
  ApiErrorBody,
  ApiErrorCode,
  MyVote,
  OwnerPollDetail,
  OwnerPollSummary,
  OwnerResults,
  ParticipantResults,
  PublicPoll,
  ResultsMode,
} from './types';

export class ApiClientError extends Error {
  code: ApiErrorCode;
  current: MyVote | null | undefined;
  retryAfterSeconds: number | undefined;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiClientError';
    this.code = body.code;
    this.current = body.current;
    this.retryAfterSeconds = body.retryAfterSeconds;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiClientError({ code: 'UNKNOWN', message: 'Network request failed. Check your connection.' });
  }

  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : undefined;

  if (!response.ok) {
    throw new ApiClientError(
      (body as ApiErrorBody | undefined) ?? {
        code: 'UNKNOWN',
        message: `Request failed with status ${response.status}.`,
      },
    );
  }

  return body as T;
}

// Dynamically imported (not a top-level `import`) so @supabase/supabase-js only ends up in the
// chunk for pages that actually call an organiser.* method, keeping it out of the voter-only
// ballot bundle that the PRD's mobile LCP target (§13) applies to.
async function authHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import('./supabaseClient');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export interface CreatePollInput {
  question: string;
  choices: string[];
  expiryDays: number;
  participantResultsMode: ResultsMode;
}

export const apiClient = {
  getPoll: (code: string) => request<PublicPoll>(`/api/polls/${encodeURIComponent(code)}`),

  establishSession: (code: string) =>
    request<void>(`/api/polls/${encodeURIComponent(code)}/session`, { method: 'POST' }),

  getMyVote: (code: string) => request<MyVote | null>(`/api/polls/${encodeURIComponent(code)}/my-vote`),

  submitVote: (code: string, optionId: string, expectedRevision: number) =>
    request<MyVote>(`/api/polls/${encodeURIComponent(code)}/my-vote`, {
      method: 'PUT',
      body: JSON.stringify({ optionId, expectedRevision }),
    }),

  getResults: (code: string) => request<ParticipantResults>(`/api/polls/${encodeURIComponent(code)}/results`),

  reportPoll: (code: string, reason: string) =>
    request<void>(`/api/polls/${encodeURIComponent(code)}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  organiser: {
    async listPolls(page: number) {
      return request<{ items: OwnerPollSummary[]; hasMore: boolean }>(`/api/organiser/polls?page=${page}`, {
        headers: await authHeaders(),
      });
    },

    async createDraft(input: CreatePollInput) {
      return request<{ id: string }>('/api/organiser/polls', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: await authHeaders(),
      });
    },

    async getPoll(id: string) {
      return request<OwnerPollDetail>(`/api/organiser/polls/${id}`, { headers: await authHeaders() });
    },

    async updateDraft(id: string, patch: Partial<CreatePollInput>) {
      return request<void>(`/api/organiser/polls/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
        headers: await authHeaders(),
      });
    },

    async deletePoll(id: string) {
      return request<void>(`/api/organiser/polls/${id}`, { method: 'DELETE', headers: await authHeaders() });
    },

    async publish(id: string) {
      return request<{ code: string }>(`/api/organiser/polls/${id}/publish`, {
        method: 'POST',
        headers: await authHeaders(),
      });
    },

    async close(id: string) {
      return request<void>(`/api/organiser/polls/${id}/close`, { method: 'POST', headers: await authHeaders() });
    },

    async getResults(id: string) {
      return request<OwnerResults>(`/api/organiser/polls/${id}/results`, { headers: await authHeaders() });
    },
  },
};
