import { useSearchParams } from 'react-router';
import { isValidReturnPath } from '../lib/validation';

const DEFAULT_RETURN_TO = '/dashboard';

/** Reads and validates ?returnTo=, rejecting anything but an internal path (PRD A21). */
export function useReturnTo(): string {
  const [searchParams] = useSearchParams();
  const raw = searchParams.get('returnTo');
  return raw && isValidReturnPath(raw) ? raw : DEFAULT_RETURN_TO;
}
