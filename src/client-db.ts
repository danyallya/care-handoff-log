import Dexie, { type Table } from 'dexie';
import type { HandoffInput, HandoffRecord } from './handoff';

export type OutboxItem = { id: string; payload: unknown; createdAt: number; attempts: number; lastError?: string };
export type HandoffDraft = { id: 'active'; data: HandoffInput; updatedAt: string };
export type AuditAction = 'reviewed' | 'consent-revoked' | 'deleted';
export type AuditMarker = {
  id: string;
  handoffId: string;
  action: AuditAction;
  occurredAt: string;
};

export class LocalDatabase extends Dexie {
  outbox!: Table<OutboxItem, string>;
  drafts!: Table<HandoffDraft, string>;
  handoffs!: Table<HandoffRecord, string>;
  auditMarkers!: Table<AuditMarker, string>;

  constructor() {
    super('idea-care-handoff-log');
    this.version(1).stores({ outbox: 'id,createdAt,attempts' });
    this.version(2).stores({
      outbox: 'id,createdAt,attempts',
      drafts: 'id,updatedAt',
      handoffs: 'id,status,handedOffAt',
      auditMarkers: 'id,handoffId,action,occurredAt',
    });
  }
}

export const localDatabase = new LocalDatabase();

export async function pruneAuditMarkers(now = new Date()): Promise<void> {
  const retentionDays = 90;
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  await localDatabase.auditMarkers.where('occurredAt').below(cutoff).delete();
}
