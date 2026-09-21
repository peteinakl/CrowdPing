export type PollStatus = 'draft' | 'open' | 'closed';
export type ResultsMode = 'after_vote' | 'after_close';

export interface PollOption {
  id: string;
  label: string;
  position: number;
}

export interface PublicPoll {
  code: string;
  question: string;
  options: PollOption[];
  status: PollStatus;
  participantResultsMode: ResultsMode;
}

export interface MyVote {
  optionId: string;
  revision: number;
}

export interface ParticipantResultOption {
  optionId: string;
  percentage: number;
}

export interface ParticipantResults {
  options: ParticipantResultOption[];
  status: PollStatus;
  isFinal: boolean;
  serverTime: string;
  /** true only in after_close mode, before the poll has closed */
  pending?: boolean;
}

export interface OwnerPollSummary {
  id: string;
  question: string;
  status: PollStatus;
  responseCount: number;
  createdAt: string;
}

export interface OwnerPollOption {
  id: string;
  label: string;
  position: number;
}

export interface OwnerPollDetail {
  id: string;
  question: string;
  status: PollStatus;
  options: OwnerPollOption[];
  participantResultsMode: ResultsMode;
  expiryDays: number;
  code: string | null;
  createdAt: string;
  publishedAt: string | null;
  closesAt: string | null;
  closedAt: string | null;
}

export interface OwnerResultOption {
  optionId: string;
  label: string;
  count: number;
  percentage: number;
}

export interface OwnerResults {
  options: OwnerResultOption[];
  totalResponses: number;
  status: PollStatus;
  isFinal: boolean;
}

export type ApiErrorCode =
  | 'POLL_NOT_FOUND'
  | 'POLL_CLOSED'
  | 'VALIDATION_ERROR'
  | 'REVISION_CONFLICT'
  | 'UNAUTHORISED'
  | 'RATE_LIMITED'
  | 'NO_SESSION'
  | 'INVALID_OPTION'
  | 'PENDING'
  | 'UNKNOWN';

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  current?: MyVote | null;
  retryAfterSeconds?: number;
}
