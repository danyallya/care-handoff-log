# Progress log

## 2026-10-27 — foundation

**Done:** localized Next/TypeScript/Tailwind/React Icons/PostgreSQL/Docker/PWA shell, Dexie/outbox starter, health route, metadata test, CI, product brief, task/backlog and operations/security notes.

**Not done:** product workflow, auth, domain tables, sync, release security review, provider, dependency install and lockfile.

**Next:** Record a non-clinical handoff with who, when and what remains.

**Delivery:** Public repository created and foundation pushed to main. The latest handoff is committed locally; push it when the cache/Docker blocker is cleared.


## Environment check — 2026-10-27

**Update:** Compose now passes PostgreSQL host, database, user and password as separate environment fields so local password characters do not break a connection URL. docker compose config --quiet passes for all 30 projects; runtime verification is pending Docker access.

Docker service com.docker.service is stopped; Start-Service cannot open it with current permissions. The npm cache registry at localhost:4873 is unavailable. Offline lockfile generation returned ETARGET for eslint-config-next@16.4.3 from the host cache. No dependency install, tests or production build ran; CI reports a warning and skips dependency installation, tests, lint and build until a lockfile is committed.

**Resolution on 2026-10-28 (Asia/Tehran):** Docker Engine was started by the user and the shared registry responded at localhost:4873. PostgreSQL 18.6 is healthy. A lockfile was generated and dependency installation passed for day-1 work.

## 2026-10-28 — day 1, CARE-LOG-001/002

**Done:** CARE-LOG-001/002 — added a typed non-clinical handoff record, date/order/length/consent validation, a review-before-save flow, a locally persisted Dexie draft, reviewed records, consent revocation and deletion, empty/error states, and device-local activity markers. Added domain tests and a lockfile. The UI states local-only storage and sync behavior.

**Verification:** `npm ci --registry=http://localhost:4873/ --prefer-offline` passed (403 packages, 0 vulnerabilities); `npm run verify` passed (typecheck, 2 test files/5 tests, lint 0 errors/1 existing PostCSS warning, production build); `npm audit` found 0 vulnerabilities. Host smoke checks returned 200 for `/`, `/api/health` and `/manifest.webmanifest`. See `docs/days/day-001.md` for GitHub and manual-check details.

**Limitations:** No account, identity or consent verification, access control, encryption, backup, remote synchronization or authoritative audit trail. User-provided notes can still contain sensitive information; the UI asks users to keep them to practical non-clinical tasks.

**Next:** CARE-LOG-003 — add PostgreSQL migrations and repository tests. Exercise offline reload, browser persistence and assistive-technology behavior in a real browser during a later visit.
