# Offline behavior

The public app shell is cached after the first visit. API responses and personalized records are not cached by the service worker. CARE-LOG-001 adds a client-side Dexie draft, reviewed handoffs and minimal activity markers; writes stay in this browser profile and are never queued for server sync. The app labels sync as local-only.

Records remain until a user deletes them or revokes consent. The single active draft remains until it is saved, discarded or removed during consent revocation. Activity markers contain only an opaque handoff ID, action and timestamp and are purged after 90 days when the app next opens or saves/removes a record. Clearing browser site data removes all records, drafts and markers. There is no export, backup, conflict handling, encryption or recovery flow. Do not store real sensitive information in this prototype.
