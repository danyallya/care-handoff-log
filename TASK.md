# Active task

**ID:** CARE-LOG-001  
**Title:** Record a non-clinical handoff with who, when and what remains.

## Context

The technical shell exists; the product workflow does not. Build the first safe, end-to-end domain slice for Care Handoff Log.

## Acceptance criteria

- Type the handoffs domain record, validation rules and lifecycle.
- Add a create/review flow that works without a server round-trip.
- Persist a draft with Dexie and show saved, unsaved and sync state truthfully.
- Test valid/invalid input, date/order boundaries and serialization.
- Document retention, deletion and limitations of the offline slice.
- Respect this guardrail: No diagnosis or treatment advice; minimize health data, require consent, revocation and audit.

## Status

Not started. Use handoff/001-care-log. After acceptance passes, update progress and set the next task.
