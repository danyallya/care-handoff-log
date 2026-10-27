# Security and data policy

- Collect the minimum data; treat user content as private by default.
- No authentication, authorization, encryption-at-rest or production backup policy exists yet. Do not enter real sensitive data.
- Keep secrets in untracked .env; never expose DB/provider keys to browsers.
- Never cache APIs, authenticated pages or personal records in the service worker.
- Define export, deletion, retention, access logs and incident response before launch.
- Domain guardrail: No diagnosis or treatment advice; minimize health data, require consent, revocation and audit.
- Review threat model, roles and offline-device recovery before launch.

## CARE-LOG-001 local handoffs

- Store only names or roles, timestamps and short practical task notes. Avoid diagnoses, treatment instructions, medication detail and full identifiers.
- Consent is a required user attestation. The app does not identify participants or independently verify consent.
- Revoking consent removes the saved handoff and current draft on this device. Deletion removes a selected record. A local marker containing an opaque ID, action and time remains for 90 days; it is not a trustworthy or tamper-resistant audit log.
- Records are browser-local and are not encrypted, backed up, access-controlled or synchronized. Do not use this prototype for real sensitive care data.
