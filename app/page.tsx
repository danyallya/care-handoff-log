'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { localDatabase, pruneAuditMarkers, type AuditAction, type AuditMarker, type HandoffDraft } from '@/client-db';
import { createHandoffRecord, localDateTimeValue, validateHandoff, type HandoffField, type HandoffInput, type HandoffIssue, type HandoffRecord } from '@/handoff';

type DraftState = 'loading' | 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

function emptyInput(): HandoffInput {
  return { from: '', to: '', handedOffAt: localDateTimeValue(), nextCheckAt: '', completed: '', remaining: '', consentConfirmed: false };
}

function formatDate(value: string): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Invalid date' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function actionLabel(action: AuditAction): string {
  if (action === 'reviewed') return 'Handoff reviewed and saved';
  if (action === 'consent-revoked') return 'Consent revoked; local copy removed';
  return 'Local copy deleted';
}

export default function HomePage() {
  const [input, setInput] = useState<HandoffInput>(emptyInput);
  const [records, setRecords] = useState<HandoffRecord[]>([]);
  const [audit, setAudit] = useState<AuditMarker[]>([]);
  const [draftState, setDraftState] = useState<DraftState>('loading');
  const [isBusy, setIsBusy] = useState(false);
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [issues, setIssues] = useState<HandoffIssue[]>([]);
  const [storageError, setStorageError] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; action: Exclude<AuditAction, 'reviewed'> } | null>(null);
  const [notice, setNotice] = useState('');
  const hydrated = useRef(false);
  const skipNextDraftSave = useRef(false);
  const draftSaveTimer = useRef<number | null>(null);
  const pendingDraftWrite = useRef<Promise<void> | null>(null);

  async function settleDraftWrite() {
    if (draftSaveTimer.current !== null) {
      window.clearTimeout(draftSaveTimer.current);
      draftSaveTimer.current = null;
    }
    await pendingDraftWrite.current;
  }

  async function refreshStoredData() {
    await pruneAuditMarkers();
    const [savedRecords, savedAudit] = await Promise.all([
      localDatabase.handoffs.orderBy('handedOffAt').reverse().toArray(),
      localDatabase.auditMarkers.orderBy('occurredAt').reverse().limit(10).toArray(),
    ]);
    setRecords(savedRecords);
    setAudit(savedAudit);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [draft, savedRecords, savedAudit] = await Promise.all([
          localDatabase.drafts.get('active'),
          localDatabase.handoffs.orderBy('handedOffAt').reverse().toArray(),
          pruneAuditMarkers().then(() => localDatabase.auditMarkers.orderBy('occurredAt').reverse().limit(10).toArray()),
        ]);
        if (cancelled) return;
        if (draft) setInput(draft.data);
        setRecords(savedRecords);
        setAudit(savedAudit);
        hydrated.current = true;
        setDraftState(draft ? 'saved' : 'idle');
      } catch {
        if (!cancelled) {
          setStorageError('Local storage is unavailable in this browser. Your handoff has not been saved.');
          hydrated.current = true;
          setDraftState('error');
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }
    setDraftState('unsaved');
    const timer = window.setTimeout(() => {
      draftSaveTimer.current = null;
      const previousWrite = pendingDraftWrite.current;
      const write = (async () => {
        setDraftState('saving');
        try {
          await previousWrite;
          const draft: HandoffDraft = { id: 'active', data: input, updatedAt: new Date().toISOString() };
          await localDatabase.drafts.put(draft);
          setDraftState('saved');
          setStorageError('');
        } catch {
          setDraftState('error');
          setStorageError('The draft could not be saved on this device.');
        }
      })();
      pendingDraftWrite.current = write;
      void write.finally(() => {
        if (pendingDraftWrite.current === write) pendingDraftWrite.current = null;
      });
    }, 450);
    draftSaveTimer.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (draftSaveTimer.current === timer) draftSaveTimer.current = null;
    };
  }, [input]);

  function updateField(field: HandoffField, value: string | boolean) {
    setInput((current) => ({ ...current, [field]: value }));
    setIssues([]);
    setNotice('');
  }

  function startReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextIssues = validateHandoff(input);
    setIssues(nextIssues);
    if (nextIssues.length) {
      document.getElementById(`field-${nextIssues[0].field}`)?.focus();
      return;
    }
    setStep('review');
    setNotice('');
  }

  async function saveReviewedHandoff() {
    const now = new Date();
    const nextIssues = validateHandoff(input, now);
    if (nextIssues.length) {
      setIssues(nextIssues);
      setStep('form');
      return;
    }
    setIsBusy(true);
    await settleDraftWrite();
    try {
      const record = createHandoffRecord(input, crypto.randomUUID(), now);
      const marker: AuditMarker = { id: crypto.randomUUID(), handoffId: record.id, action: 'reviewed', occurredAt: now.toISOString() };
      await localDatabase.transaction('rw', localDatabase.handoffs, localDatabase.drafts, localDatabase.auditMarkers, async () => {
        await localDatabase.handoffs.add(record);
        await localDatabase.auditMarkers.add(marker);
        await localDatabase.drafts.delete('active');
      });
    } catch {
      setStorageError('The handoff could not be saved. Your local draft is still available.');
      setDraftState('error');
      setIsBusy(false);
      return;
    }

    skipNextDraftSave.current = true;
    setInput(emptyInput());
    setIssues([]);
    setStep('form');
    setDraftState('idle');
    setIsBusy(false);
    setNotice('Handoff saved on this device. It was not uploaded or shared.');
    setStorageError('');
    try {
      await refreshStoredData();
    } catch {
      setStorageError('The handoff was saved on this device, but the list could not be refreshed. Reload to confirm it.');
    }
  }

  async function removeHandoff(id: string, action: Exclude<AuditAction, 'reviewed'>) {
    const now = new Date().toISOString();
    const marker: AuditMarker = { id: crypto.randomUUID(), handoffId: id, action, occurredAt: now };
    setIsBusy(true);
    if (action === 'consent-revoked') await settleDraftWrite();
    try {
      await localDatabase.transaction('rw', localDatabase.handoffs, localDatabase.drafts, localDatabase.auditMarkers, async () => {
        await localDatabase.handoffs.delete(id);
        await localDatabase.auditMarkers.add(marker);
        if (action === 'consent-revoked') await localDatabase.drafts.clear();
      });
    } catch {
      setStorageError('The handoff could not be removed. No deletion was recorded.');
      setIsBusy(false);
      return;
    }

    setPendingRemoval(null);
    if (action === 'consent-revoked') {
      skipNextDraftSave.current = true;
      setInput(emptyInput());
      setIssues([]);
      setStep('form');
      setDraftState('idle');
      setNotice('Consent was revoked and the saved handoff and draft were removed from this device.');
    } else {
      setNotice('The saved handoff was deleted from this device.');
    }
    setIsBusy(false);
    setStorageError('');
    try {
      await refreshStoredData();
    } catch {
      setStorageError('The change was saved, but the list could not be refreshed. Reload to confirm it.');
    }
  }

  async function discardDraft() {
    setIsBusy(true);
    await settleDraftWrite();
    try {
      await localDatabase.drafts.delete('active');
      skipNextDraftSave.current = true;
      setInput(emptyInput());
      setIssues([]);
      setStep('form');
      setDraftState('idle');
      setIsBusy(false);
      setStorageError('');
      setNotice('The draft was discarded from this device.');
    } catch {
      setStorageError('The draft could not be removed from this device.');
      setIsBusy(false);
    }
  }

  const issueFor = (field: HandoffField) => issues.find((issue) => issue.field === field)?.message;
  const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700';
  const buttonClass = 'rounded-lg bg-sky-800 px-4 py-2 font-semibold text-white hover:bg-sky-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-800">Care Handoff Log · local record</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">A clear, non-clinical handoff</h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-700">Record who handed off a task, when it happened, and what remains. This first version stays on this device and does not offer medical guidance.</p>
        </header>

        <section aria-label="Storage and sync status" className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">Draft on this device</h2>
            <p className="mt-1 text-sm text-slate-700" aria-live="polite">
              {draftState === 'loading' && 'Checking local storage…'}
              {draftState === 'idle' && 'No unsaved changes'}
              {draftState === 'unsaved' && 'Unsaved changes'}
              {draftState === 'saving' && 'Saving draft locally…'}
              {draftState === 'saved' && 'Draft saved locally'}
              {draftState === 'error' && 'Local save failed'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">Sync</h2>
            <p className="mt-1 text-sm text-slate-700">Local only · never uploaded · not shared with other devices</p>
          </div>
        </section>

        {storageError && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{storageError}</p>}
        {notice && <p aria-live="polite" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">{notice}</p>}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {step === 'form' ? (
            <>
              <div className="mb-5">
                <h2 className="text-xl font-bold">New handoff</h2>
                <p className="mt-1 text-sm text-slate-600">Use names or roles only. Leave out diagnoses, treatment instructions, medication details and full identifiers.</p>
              </div>
              {issues.length > 0 && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">Please fix the highlighted fields before reviewing.</div>}
              <form onSubmit={startReview} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium" htmlFor="field-from">Handed off by
                    <input id="field-from" className={fieldClass} maxLength={80} autoComplete="off" value={input.from} disabled={isBusy} onChange={(event) => updateField('from', event.target.value)} aria-invalid={Boolean(issueFor('from'))} aria-describedby={issueFor('from') ? 'error-from' : undefined} />
                    {issueFor('from') && <span id="error-from" className="mt-1 block text-sm text-red-800">{issueFor('from')}</span>}
                  </label>
                  <label className="block text-sm font-medium" htmlFor="field-to">Handed off to
                    <input id="field-to" className={fieldClass} maxLength={80} autoComplete="off" value={input.to} disabled={isBusy} onChange={(event) => updateField('to', event.target.value)} aria-invalid={Boolean(issueFor('to'))} aria-describedby={issueFor('to') ? 'error-to' : undefined} />
                    {issueFor('to') && <span id="error-to" className="mt-1 block text-sm text-red-800">{issueFor('to')}</span>}
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium" htmlFor="field-handedOffAt">Handoff date and time
                    <input id="field-handedOffAt" type="datetime-local" className={fieldClass} value={input.handedOffAt} disabled={isBusy} onChange={(event) => updateField('handedOffAt', event.target.value)} aria-invalid={Boolean(issueFor('handedOffAt'))} aria-describedby={issueFor('handedOffAt') ? 'error-handedOffAt' : undefined} />
                    {issueFor('handedOffAt') && <span id="error-handedOffAt" className="mt-1 block text-sm text-red-800">{issueFor('handedOffAt')}</span>}
                  </label>
                  <label className="block text-sm font-medium" htmlFor="field-nextCheckAt">Next check-in (optional)
                    <input id="field-nextCheckAt" type="datetime-local" className={fieldClass} value={input.nextCheckAt} disabled={isBusy} onChange={(event) => updateField('nextCheckAt', event.target.value)} aria-invalid={Boolean(issueFor('nextCheckAt'))} aria-describedby={issueFor('nextCheckAt') ? 'error-nextCheckAt' : undefined} />
                    {issueFor('nextCheckAt') && <span id="error-nextCheckAt" className="mt-1 block text-sm text-red-800">{issueFor('nextCheckAt')}</span>}
                  </label>
                </div>

                <label className="block text-sm font-medium" htmlFor="field-completed">Tasks completed (optional)
                  <textarea id="field-completed" className={fieldClass} rows={3} maxLength={500} value={input.completed} disabled={isBusy} onChange={(event) => updateField('completed', event.target.value)} aria-invalid={Boolean(issueFor('completed'))} aria-describedby={issueFor('completed') ? 'error-completed' : 'help-completed'} />
                  <span id="help-completed" className="mt-1 block font-normal text-slate-600">Keep it to simple logistics, such as a meal or a ride.</span>
                  {issueFor('completed') && <span id="error-completed" className="mt-1 block text-sm text-red-800">{issueFor('completed')}</span>}
                </label>

                <label className="block text-sm font-medium" htmlFor="field-remaining">What remains
                  <textarea id="field-remaining" className={fieldClass} rows={3} maxLength={500} value={input.remaining} disabled={isBusy} onChange={(event) => updateField('remaining', event.target.value)} aria-invalid={Boolean(issueFor('remaining'))} aria-describedby={issueFor('remaining') ? 'error-remaining' : 'help-remaining'} />
                  <span id="help-remaining" className="mt-1 block font-normal text-slate-600">Describe a practical next step, not a health decision.</span>
                  {issueFor('remaining') && <span id="error-remaining" className="mt-1 block text-sm text-red-800">{issueFor('remaining')}</span>}
                </label>

                <div>
                  <label className="flex items-start gap-3 text-sm leading-6" htmlFor="field-consentConfirmed">
                    <input id="field-consentConfirmed" type="checkbox" className="mt-1 size-4 accent-sky-800" checked={input.consentConfirmed} disabled={isBusy} onChange={(event) => updateField('consentConfirmed', event.target.checked)} aria-invalid={Boolean(issueFor('consentConfirmed'))} aria-describedby={issueFor('consentConfirmed') ? 'error-consentConfirmed' : 'help-consentConfirmed'} />
                    <span>I confirm that the people named have agreed to this local handoff record. This is my statement; the app cannot verify identities or consent.</span>
                  </label>
                  {issueFor('consentConfirmed') ? <span id="error-consentConfirmed" className="mt-1 block text-sm text-red-800">{issueFor('consentConfirmed')}</span> : <span id="help-consentConfirmed" className="sr-only">Consent confirmation is required before review.</span>}
                </div>

                <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
                  <button type="submit" className={buttonClass} disabled={isBusy || draftState === 'loading' || draftState === 'error'}>Review handoff</button>
                  <button type="button" onClick={() => void discardDraft()} disabled={isBusy} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-50">Discard draft</button>
                </div>
              </form>
            </>
          ) : (
            <div>
              <h2 className="text-xl font-bold">Review before saving</h2>
              <p className="mt-1 text-sm text-slate-600">Confirm these details before they are stored on this device. Nothing will be sent to a server.</p>
              <dl className="mt-5 grid gap-x-6 gap-y-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                <div><dt className="text-xs font-semibold uppercase text-slate-600">Handed off by</dt><dd className="mt-1">{input.from.trim()}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-slate-600">Handed off to</dt><dd className="mt-1">{input.to.trim()}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-slate-600">Handoff time</dt><dd className="mt-1">{formatDate(input.handedOffAt)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-slate-600">Next check-in</dt><dd className="mt-1">{formatDate(input.nextCheckAt)}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-600">Completed</dt><dd className="mt-1 whitespace-pre-wrap">{input.completed.trim() || 'Not recorded'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-600">What remains</dt><dd className="mt-1 whitespace-pre-wrap">{input.remaining.trim()}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-600">Consent</dt><dd className="mt-1">User confirmed agreement for this local record</dd></div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => setStep('form')} disabled={isBusy} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-50">Back to edit</button>
                <button type="button" onClick={() => void saveReviewedHandoff()} disabled={isBusy} className={buttonClass}>Confirm and save locally</button>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="saved-handoffs-heading" className="space-y-4">
          <div>
            <h2 id="saved-handoffs-heading" className="text-xl font-bold">Saved on this device</h2>
            <p className="mt-1 text-sm text-slate-600">Records are visible only in this browser profile. Clear browser storage to remove all local data.</p>
          </div>
          {records.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">No saved handoffs yet.</p> : records.map((record) => (
            <article key={record.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{record.from} <span aria-hidden="true">→</span> {record.to}</h3>
                  <p className="mt-1 text-sm text-slate-600">{formatDate(record.handedOffAt)} · Reviewed locally</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={isBusy} onClick={() => setPendingRemoval({ id: record.id, action: 'consent-revoked' })} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-900 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50">Revoke consent</button>
                  <button type="button" disabled={isBusy} onClick={() => setPendingRemoval({ id: record.id, action: 'deleted' })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-50">Delete record</button>
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="font-semibold">Next check-in</dt><dd className="mt-1 text-slate-700">{formatDate(record.nextCheckAt)}</dd></div>
                <div><dt className="font-semibold">Completed</dt><dd className="mt-1 whitespace-pre-wrap text-slate-700">{record.completed || 'Not recorded'}</dd></div>
                <div className="sm:col-span-2"><dt className="font-semibold">What remains</dt><dd className="mt-1 whitespace-pre-wrap text-slate-700">{record.remaining}</dd></div>
              </dl>
              {pendingRemoval?.id === record.id && (
                <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4" role="group" aria-label={pendingRemoval.action === 'consent-revoked' ? 'Confirm consent revocation' : 'Confirm record deletion'}>
                  <p className="text-sm text-red-950">{pendingRemoval.action === 'consent-revoked' ? 'Revoking consent removes this saved handoff and the current draft from this device.' : 'This removes the saved handoff from this device.'} An audit marker without names or task details is retained for up to 90 days.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void removeHandoff(record.id, pendingRemoval.action)} disabled={isBusy} className="rounded-lg bg-red-800 px-3 py-2 text-sm font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50">{pendingRemoval.action === 'consent-revoked' ? 'Revoke and remove local copy' : 'Delete local copy'}</button>
                    <button type="button" onClick={() => setPendingRemoval(null)} disabled={isBusy} className="rounded-lg border border-slate-400 px-3 py-2 text-sm font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-50">Keep record</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>

        <section aria-labelledby="audit-heading" className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 id="audit-heading" className="font-bold">Local activity markers</h2>
          <p className="mt-1 text-sm text-slate-600">A minimal device-local log of saves and removals; it contains no names or task text and is not an authoritative audit service.</p>
          {audit.length === 0 ? <p className="mt-3 text-sm text-slate-600">No activity recorded yet.</p> : <ul className="mt-3 space-y-2">{audit.map((entry) => <li key={entry.id} className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-2 text-sm"><span>{actionLabel(entry.action)}</span><time dateTime={entry.occurredAt} className="text-slate-600">{formatDate(entry.occurredAt)}</time></li>)}</ul>}
        </section>

        <footer className="border-t border-slate-200 pt-5 text-sm leading-6 text-slate-600">
          <p>Storage is local to this browser. There is no account, identity check, consent verification, remote sync, backup or access control. Keep records to practical non-clinical tasks. Delete a record or revoke consent at any time.</p>
        </footer>
      </div>
    </main>
  );
}
