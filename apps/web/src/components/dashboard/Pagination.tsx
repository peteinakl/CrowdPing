import { Button } from '../common/Button';

interface PaginationProps {
  page: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, hasMore, onPageChange }: PaginationProps) {
  if (page === 0 && !hasMore) return null;
  return (
    <div className="flex items-center justify-between pt-4">
      <Button variant="ghost" onClick={() => onPageChange(page - 1)} disabled={page === 0}>
        Previous
      </Button>
      <span className="font-mono text-sm text-ink-500">Page {page + 1}</span>
      <Button variant="ghost" onClick={() => onPageChange(page + 1)} disabled={!hasMore}>
        Next
      </Button>
    </div>
  );
}
