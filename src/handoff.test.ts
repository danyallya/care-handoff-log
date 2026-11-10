import { describe, expect, it } from 'vitest';
import { createHandoffRecord, validateHandoff, type HandoffInput } from './handoff';

const now = new Date('2026-10-27T12:00:00.000Z');
const validInput: HandoffInput = {
  from: '  Alex  ',
  to: 'Sam',
  handedOffAt: '2026-10-27T11:00:00.000Z',
  nextCheckAt: '2026-10-27T13:00:00.000Z',
  completed: 'Meal prepared',
  remaining: 'Check whether groceries arrived',
  consentConfirmed: true,
};

describe('care handoff domain', () => {
  it('accepts a complete non-clinical handoff at the current-time boundary', () => {
    expect(validateHandoff({ ...validInput, handedOffAt: now.toISOString() }, now)).toEqual([]);
  });

  it('requires people, remaining work, a valid date and recorded consent', () => {
    const issues = validateHandoff({
      ...validInput,
      from: ' ',
      to: '',
      remaining: '',
      handedOffAt: 'not-a-date',
      consentConfirmed: false,
    }, now);
    expect(issues.map(({ field }) => field)).toEqual(['from', 'to', 'remaining', 'handedOffAt', 'consentConfirmed']);
  });

  it('rejects a future handoff and a check-in before the handoff', () => {
    const issues = validateHandoff({
      ...validInput,
      handedOffAt: '2026-10-27T12:00:01.000Z',
      nextCheckAt: '2026-10-27T11:59:59.000Z',
    }, now);
    expect(issues.map(({ field }) => field)).toContain('handedOffAt');
    expect(issues.map(({ field }) => field)).toContain('nextCheckAt');
  });

  it('trims user text and survives JSON serialization as a reviewed local record', () => {
    const record = createHandoffRecord(validInput, 'opaque-id', now);
    const restored = JSON.parse(JSON.stringify(record));
    expect(restored.from).toBe('Alex');
    expect(restored.status).toBe('reviewed');
    expect(restored.consentConfirmed).toBe(true);
    expect(restored.reviewedAt).toBe(now.toISOString());
    expect(restored.handedOffAt).toBe('2026-10-27T11:00:00.000Z');
  });
});
