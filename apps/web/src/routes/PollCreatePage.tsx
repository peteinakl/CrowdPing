import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/common/AppShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { FormActionBar } from '../components/common/FormActionBar';
import { ChoiceListEditor } from '../components/create/ChoiceListEditor';
import { ExpirySelector } from '../components/create/ExpirySelector';
import { ResultsTimingSelector } from '../components/create/ResultsTimingSelector';
import { MobilePreviewPane } from '../components/create/MobilePreviewPane';
import { useToast } from '../components/common/Toast';
import { apiClient } from '../lib/apiClient';
import { QUESTION_MAX, validateChoiceList, validateQuestion } from '../lib/validation';
import type { ResultsMode } from '../lib/types';

export function PollCreatePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState(['', '']);
  const [expiryDays, setExpiryDays] = useState(1);
  const [resultsMode, setResultsMode] = useState<ResultsMode>('after_vote');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLParagraphElement | null>(null);

  async function handleCreateDraft() {
    const questionError = validateQuestion(question);
    const choicesError = validateChoiceList(choices);
    if (questionError || choicesError) {
      setError(questionError ?? choicesError);
      requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const trimmedChoices = choices.map((c) => c.trim()).filter((c) => c.length > 0);
      const { id } = await apiClient.organiser.createDraft({
        question: question.trim(),
        choices: trimmedChoices,
        expiryDays,
        participantResultsMode: resultsMode,
      });
      showToast("Draft saved — publish when you're ready.");
      navigate(`/polls/${id}`);
    } catch {
      setError('Could not save your draft. Please try again.');
      requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink-950">Create a poll</h1>
            <p className="mt-1 text-ink-500">One question, up to eight answers.</p>
          </div>

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
                maxLength={QUESTION_MAX}
                className="w-full rounded-[var(--radius-md)] border-2 border-ink-100 px-4 py-3 text-base focus:border-accent-600 focus:outline-none"
                placeholder="What should we build next?"
              />
              <p className="mt-1 text-right text-xs text-ink-300">
                {question.length}/{QUESTION_MAX}
              </p>
            </div>

            <ChoiceListEditor choices={choices} onChange={setChoices} />
            <ExpirySelector value={expiryDays} onChange={setExpiryDays} />
            <ResultsTimingSelector value={resultsMode} onChange={setResultsMode} />

            {error && (
              <p ref={errorRef} role="alert" className="text-sm font-medium text-red-700">
                {error}
              </p>
            )}
          </Card>
        </div>

        <div className="hidden lg:block">
          <p className="mb-3 text-center text-sm font-medium text-ink-500">Mobile preview</p>
          <MobilePreviewPane question={question} choices={choices} />
        </div>
      </div>

      <FormActionBar>
        <Button onClick={handleCreateDraft} disabled={busy} size="lg" className="w-full sm:w-auto">
          {busy ? 'Saving…' : 'Save draft'}
        </Button>
      </FormActionBar>
    </AppShell>
  );
}
