# Decision log

## 0001 — Independent repository

Each product owns its history, task queue and release boundary.

## 0002 — Shell cache is not offline product data

The service worker stores public shell only. Records need an explicit local schema, conflict policy and recovery review.

## 0003 — Verify provider terms before integration

External sources require verified official terms, attribution, server-side credentials and visible source timestamps.

## 0004 — Keep the first handoff workflow local

CARE-LOG-001 stores drafts and reviewed handoffs in Dexie without a server round-trip. Consent is a user attestation, not identity verification. Deletion and revocation remove local content; a content-free marker with an opaque handoff ID and timestamp is retained for up to 90 days. This is a prototype boundary, not a production privacy or audit guarantee.
