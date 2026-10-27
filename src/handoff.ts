export type HandoffInput = {
  from: string;
  to: string;
  handedOffAt: string;
  nextCheckAt: string;
  completed: string;
  remaining: string;
  consentConfirmed: boolean;
};

export type HandoffStatus = 'reviewed';

export type HandoffRecord = Omit<HandoffInput, 'consentConfirmed'> & {
  id: string;
  consentConfirmed: true;
  consentedAt: string;
  createdAt: string;
  reviewedAt: string;
  status: HandoffStatus;
};

export type HandoffField = keyof HandoffInput;
export type HandoffIssue = { field: HandoffField; message: string };

export function validateHandoff(input: HandoffInput, now = new Date()): HandoffIssue[] {
  const issues: HandoffIssue[] = [];
  const required: Array<'from' | 'to' | 'remaining'> = ['from', 'to', 'remaining'];

  for (const field of required) {
    if (!input[field].trim()) issues.push({ field, message: 'This field is required.' });
  }
  if (input.from.trim().length > 80) issues.push({ field: 'from', message: 'Use at most 80 characters.' });
  if (input.to.trim().length > 80) issues.push({ field: 'to', message: 'Use at most 80 characters.' });
  if (input.completed.trim().length > 500) issues.push({ field: 'completed', message: 'Use at most 500 characters.' });
  if (input.remaining.trim().length > 500) issues.push({ field: 'remaining', message: 'Use at most 500 characters.' });

  const handedOffAt = Date.parse(input.handedOffAt);
  if (!input.handedOffAt || !Number.isFinite(handedOffAt)) {
    issues.push({ field: 'handedOffAt', message: 'Enter a valid handoff date and time.' });
  } else if (handedOffAt > now.getTime()) {
    issues.push({ field: 'handedOffAt', message: 'Handoff time cannot be in the future.' });
  }

  if (input.nextCheckAt) {
    const nextCheckAt = Date.parse(input.nextCheckAt);
    if (!Number.isFinite(nextCheckAt)) {
      issues.push({ field: 'nextCheckAt', message: 'Enter a valid check-in date and time.' });
    } else if (Number.isFinite(handedOffAt) && nextCheckAt < handedOffAt) {
      issues.push({ field: 'nextCheckAt', message: 'Check-in cannot be earlier than the handoff.' });
    }
  }

  if (!input.consentConfirmed) {
    issues.push({ field: 'consentConfirmed', message: 'Confirm that the people named agreed to this local record.' });
  }
  return issues;
}

export function createHandoffRecord(
  input: HandoffInput,
  id: string,
  now = new Date(),
): HandoffRecord {
  const issues = validateHandoff(input, now);
  if (issues.length) throw new Error('Cannot create a handoff from invalid input.');

  const timestamp = now.toISOString();
  return {
    id,
    from: input.from.trim(),
    to: input.to.trim(),
    handedOffAt: new Date(input.handedOffAt).toISOString(),
    nextCheckAt: input.nextCheckAt ? new Date(input.nextCheckAt).toISOString() : '',
    completed: input.completed.trim(),
    remaining: input.remaining.trim(),
    consentConfirmed: true,
    consentedAt: timestamp,
    createdAt: timestamp,
    reviewedAt: timestamp,
    status: 'reviewed',
  };
}

export function localDateTimeValue(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
