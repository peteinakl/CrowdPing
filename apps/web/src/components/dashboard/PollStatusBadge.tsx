import type { PollStatus } from '../../lib/types';
import { LivePulse } from '../common/LivePulse';

const LABELS: Record<PollStatus, string> = { draft: 'Draft', open: 'Open', closed: 'Closed' };
const CLASSES: Record<PollStatus, string> = {
  draft: 'bg-ink-100 text-ink-700',
  open: 'bg-accent-50 text-accent-700',
  closed: 'bg-ink-300/30 text-ink-500',
};

export function PollStatusBadge({ status }: { status: PollStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${CLASSES[status]}`}
    >
      {status === 'open' && <LivePulse />}
      {LABELS[status]}
    </span>
  );
}
