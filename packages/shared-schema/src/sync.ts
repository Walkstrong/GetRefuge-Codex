export type SyncStatus = 'pending' | 'synced' | 'failed'

export interface SyncPayload {
  records: unknown[]
}
