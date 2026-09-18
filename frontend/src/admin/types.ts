export type SyncLog = {
  id: string
  type: 'hierarchy' | 'insights'
  startedAt: string
  finishedAt: string | null
  status: 'success' | 'failed'
  itemsProcessed: number
  errorMessage: string | null
}

export type MetaConnectionStatus = {
  configured: boolean
  connectionStatus: string
  accountId: string | null
  accountName: string | null
  lastCheckedAt: string | null
  lastCheckedError: string | null
  lastSyncAt: string | null
  lastSyncStatus: string | null
  lastSyncError: string | null
  isSyncing: boolean
  recentLogs: SyncLog[]
}
