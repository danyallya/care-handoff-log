# Active task

**ID:** CARE-LOG-003
**Title:** Add PostgreSQL migrations and repository tests.

## Context

The first workflow is a browser-local prototype. Define its server-side persistence boundary without implying authorization, consent verification or production readiness.

## Acceptance criteria

- Add versioned PostgreSQL migrations for the handoff and minimal audit data model.
- Add repository operations and integration tests against a disposable database.
- Preserve the non-clinical scope and collect no unnecessary health details.
- Document migration, backup, deletion and test-database handling.

## Status

Not started. Use `handoff/care-log-003-postgres-repository` after CARE-LOG-001/002 is reviewed and merged.

## Completed on the day-1 branch

- CARE-LOG-001 — Record a non-clinical handoff with who, when and what remains.
- CARE-LOG-002 — Validate handoffs and add empty, error and deletion states.

Evidence: `docs/days/day-001.md`. Both tasks are complete locally, pending PR review and merge.
