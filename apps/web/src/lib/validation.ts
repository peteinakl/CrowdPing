// Client-side mirror of the PRD's validation rules (§3), for fast UX feedback
// only. The database is the authoritative enforcement point — see
// supabase/functions/_shared/validation.ts and the CHECK constraints in
// supabase/migrations/.

export const QUESTION_MAX = 240;
export const CHOICE_MAX = 120;
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 8;

export function validateQuestion(question: string): string | null {
  const trimmed = question.trim();
  if (trimmed.length < 1) return 'Enter a question.';
  if (trimmed.length > QUESTION_MAX) return `Question must be ${QUESTION_MAX} characters or fewer.`;
  return null;
}

export function validateChoice(choice: string): string | null {
  const trimmed = choice.trim();
  if (trimmed.length < 1) return 'Enter an answer.';
  if (trimmed.length > CHOICE_MAX) return `Answer must be ${CHOICE_MAX} characters or fewer.`;
  return null;
}

function normaliseForComparison(value: string): string {
  return value.trim().normalize('NFKC').toLowerCase();
}

export function validateChoiceList(choices: string[]): string | null {
  const nonEmpty = choices.filter((c) => c.trim().length > 0);
  if (nonEmpty.length < OPTIONS_MIN) return `Add at least ${OPTIONS_MIN} answers.`;
  if (nonEmpty.length > OPTIONS_MAX) return `A poll can have at most ${OPTIONS_MAX} answers.`;

  const seen = new Set<string>();
  for (const choice of nonEmpty) {
    const key = normaliseForComparison(choice);
    if (seen.has(key)) return 'Remove duplicate answers.';
    seen.add(key);
  }

  return null;
}

export function isValidReturnPath(path: string): boolean {
  // Rejects protocol-relative ("//host/...") and absolute URLs to prevent
  // open-redirect via the sign-in returnTo parameter (PRD A21).
  return path.startsWith('/') && !path.startsWith('//');
}
