export type SyncStatus = 'pending' | 'synced' | 'failed'

export interface SyncState {
  lastSync: number | null
  pendingCount: number
  failedCount: number
  isOnline: boolean
  isSyncing: boolean
}
