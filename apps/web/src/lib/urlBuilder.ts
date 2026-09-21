import { env } from './env';

/**
 * The one shared URL builder for the voting link. Every place that shows a
 * voting URL — the copy-link button, the on-screen presentation URL, and the
 * QR code target — must go through this function so all three always match
 * exactly (PRD §6, acceptance criterion A19).
 */
export function buildVoteUrl(code: string): string {
  return new URL(`/p/${encodeURIComponent(code)}`, env.appBaseUrl).href;
}

/** Human-readable form for on-screen display (no protocol, for readability at a distance). */
export function displayVoteUrl(code: string): string {
  const url = new URL(buildVoteUrl(code));
  return `${url.host}${url.pathname}`;
}
