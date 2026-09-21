import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/common/AppShell';
import { Card } from '../components/common/Card';
import { Button, buttonClasses } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/Dialog';
import { FormActionBar } from '../components/common/FormActionBar';
import { PollStatusBadge } from '../components/dashboard/PollStatusBadge';
import { LivePulse } from '../components/common/LivePulse';
import { ChoiceListEditor } from '../components/create/ChoiceListEditor';
import { ExpirySelector } from '../components/create/ExpirySelector';
import { ResultsTimingSelector } from '../components/create/ResultsTimingSelector';
import { useToast } from '../components/common/Toast';
import { apiClient } from '../lib/apiClient';
import { buildVoteUrl } from '../lib/urlBuilder';
import { toPngDataUrl, toSvgString } from '../lib/qr';
import { validateChoiceList, validateQuestion } from '../lib/validation';
import type { OwnerPollDetail, OwnerResults, ResultsMode } from '../lib/types';

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function PollManagePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [poll, setPoll] = useState<OwnerPollDetail | null>(null);
  const [results, setResults] = useState<OwnerResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState<string[]>([]);
  const [expiryDays, setExpiryDays] = useState(7);
  const [resultsMode, setResultsMode] = useState<ResultsMode>('after_vote');
  const [saving, setSaving] = useState(false);
  // Separate from `error` (page-load failure, gates the whole page below) — a bad draft save
  // must only replace the inline message in the form, never the entire page. These were
  // previously the same state, which meant a validation error (e.g. empty question) collapsed
  // the whole page down to a bare error line, losing the form entirely.
  const [formError, setFormError] = useState<string | null>(null);

  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const errorRef = useRef<HTMLParagraphElement | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const detail = await apiClient.organiser.getPoll(id);
      setPoll(detail);
      setQuestion(detail.question);
      setChoices(detail.options.map((o) => o.label));
      setExpiryDays(detail.expiryDays);
      setResultsMode(detail.participantResultsMode);
      setError(null);
      if (detail.status !== 'draft') {
        const ownerResults = await apiClient.organiser.getResults(id);
        setResults(ownerResults);
      }
    } catch {
      setError('Could not load this poll.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <AppShell>
        <p className="text-ink-500">Loading…</p>
      </AppShell>
    );
  }

  if (error || !poll || !id) {
    return (
      <AppShell>
        <p role="alert" className="text-red-700">
          {error ?? 'Poll not found.'}
        </p>
      </AppShell>
    );
  }

  async function handleSaveDraft() {
    const questionError = validateQuestion(question);
    const choicesError = validateChoiceList(choices);
    if (questionError || choicesError) {
      setFormError(questionError ?? choicesError);
      requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const trimmedChoices = choices.map((c) => c.trim()).filter((c) => c.length > 0);
      await apiClient.organiser.updateDraft(id as string, {
        question: question.trim(),
        choices: trimmedChoices,
        expiryDays,
        participantResultsMode: resultsMode,
      });
      showToast('Saved. Still yours to change.');
      await load();
    } catch {
      setFormError('Could not save changes.');
      requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setConfirmPublish(false);
    try {
      await apiClient.organiser.publish(id as string);
      showToast('Live! Go project that code.');
      await load();
    } catch {
      showToast("Publish didn't go through. Try again?", 'error');
    }
  }

  async function handleClose() {
    setConfirmClose(false);
    try {
      await apiClient.organiser.close(id as string);
      showToast("That's a wrap — voting's closed.");
      await load();
    } catch {
      showToast("Couldn't close it. Try again?", 'error');
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    try {
      await apiClient.organiser.deletePoll(id as string);
      showToast("Deleted. It's really gone.");
      navigate('/dashboard');
    } catch {
      showToast("Couldn't delete it. Try again?", 'error');
    }
  }

  async function handleDownloadSvg() {
    if (!poll || !poll.code) return;
    const svg = await toSvgString(buildVoteUrl(poll.code));
    downloadText(`crowdping-${poll.code}.svg`, svg, 'image/svg+xml');
  }

  async function handleDownloadPng() {
    if (!poll || !poll.code) return;
    const dataUrl = await toPngDataUrl(buildVoteUrl(poll.code));
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `crowdping-${poll.code}.png`;
    a.click();
  }

  const deleteCopy =
    poll.status === 'draft'
      ? {
          eyebrow: 'Heads up',
          title: 'Scrap this draft?',
          description: "Gone. No recovering it, no undo, nothing waiting in a trash folder.",
          confirmLabel: 'Delete draft',
        }
      : {
          eyebrow: 'Point of no return',
          title: 'Delete this poll?',
          description:
            'Every vote, every result, the whole poll — deleted for good. This is permanent, not just closed.',
          confirmLabel: 'Delete forever',
        };

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-950">Manage poll</h1>
        <PollStatusBadge status={poll.status} />
      </div>

      {poll.status === 'draft' && (
        <>
          <Card className="mb-28 space-y-6">
            <div>
              <label htmlFor="question" className="mb-1 block text-sm font-semibold text-ink-950">
                Question
              </label>
              <textarea
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={2}
                className="w-full rounded-[var(--radius-md)] border-2 border-ink-100 px-4 py-3 text-base focus:border-accent-600 focus:outline-none"
              />
            </div>
            <ChoiceListEditor choices={choices} onChange={setChoices} />
            <ExpirySelector value={expiryDays} onChange={setExpiryDays} />
            <ResultsTimingSelector value={resultsMode} onChange={setResultsMode} />

            {formError && (
              <p ref={errorRef} role="alert" className="text-sm font-medium text-red-700">
                {formError}
              </p>
            )}
          </Card>

          <FormActionBar>
            <Button variant="secondary" onClick={handleSaveDraft} disabled={saving}>
              {saving ? 'Saving…' : 'Save draft'}
            </Button>
            <Button onClick={() => setConfirmPublish(true)}>Publish</Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete draft
            </Button>
          </FormActionBar>
        </>
      )}

      {poll.status !== 'draft' && (
        <div className="space-y-8">
          <Card>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink-950">{poll.question}</h2>
            <ul className="mt-3 space-y-1 text-sm text-ink-500">
              {poll.options.map((option) => (
                <li key={option.id}>{option.label}</li>
              ))}
            </ul>
          </Card>

          {poll.code && (
            <Card className="space-y-4">
              <h3 className="font-display text-base font-semibold tracking-tight text-ink-950">Share</h3>
              <p className="break-all rounded-[var(--radius-md)] bg-ink-100 px-4 py-3 font-mono text-sm text-ink-700">
                {buildVoteUrl(poll.code)}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!poll.code) return;
                    navigator.clipboard.writeText(buildVoteUrl(poll.code));
                    showToast('Copied. Go paste it everywhere.');
                  }}
                >
                  Copy link
                </Button>
                <Button variant="secondary" onClick={handleDownloadSvg}>
                  Download SVG
                </Button>
                <Button variant="secondary" onClick={handleDownloadPng}>
                  Download PNG
                </Button>
                {/* This whole block is already gated on poll.status !== 'draft' (published
                    polls only) — Present should stay available after closing too, so the
                    organiser can still show the room final results (PRD §4). */}
                <Link to={`/polls/${id}/present`} className={buttonClasses('primary', 'md')}>
                  Present
                </Link>
              </div>
            </Card>
          )}

          {results && (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-display text-base font-semibold tracking-tight text-ink-950">
                  {!results.isFinal && <LivePulse />}
                  Results {results.isFinal ? '(final)' : '(live)'}
                </h3>
                <p className="font-mono text-sm text-ink-500">{results.totalResponses} total responses</p>
              </div>
              <ul className="space-y-3">
                {results.options.map((option) => (
                  <li key={option.optionId} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-ink-950">{option.label}</span>
                    <span className="font-mono tabular-nums text-ink-700">
                      {option.count} · {option.percentage.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="flex flex-wrap gap-3">
            {poll.status === 'open' && (
              <Button variant="danger" onClick={() => setConfirmClose(true)}>
                Close voting
              </Button>
            )}
            {poll.status === 'closed' && (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete poll
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        eyebrow="Going live"
        title="Lock it in?"
        description="Your question and answers freeze the second you publish — everyone scans the same poll, forever. No sneaky edits after this."
        confirmLabel="Publish"
        onConfirm={handlePublish}
      />
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        eyebrow="Final call"
        title="Cut off voting?"
        description="The second you hit this, nobody votes again — not even you. Final results only, from here."
        confirmLabel="Close voting"
        variant="danger"
        onConfirm={handleClose}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        eyebrow={deleteCopy.eyebrow}
        title={deleteCopy.title}
        description={deleteCopy.description}
        confirmLabel={deleteCopy.confirmLabel}
        variant="danger"
        onConfirm={handleDelete}
      />
    </AppShell>
  );
}
