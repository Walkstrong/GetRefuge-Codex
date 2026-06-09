export { SyncStatus, SyncState } from './status'
export { getPendingRecords, getPendingAiChecks, markSynced, markFailed, markAiCheckSynced, markAiCheckFailed } from './queue'
export { getRetryDelay, RETRY_DELAYS, MAX_RETRIES } from './retry'
export { uploadRecord, uploadPhoto, uploadAiCheck } from './upload'

import { getPendingAiChecks, getPendingRecords, markAiCheckFailed, markAiCheckSynced, markFailed, markSynced } from './queue'
import { isDuplicateUploadError, uploadAiCheck, uploadRecord, uploadPhoto } from './upload'
import { getRetryDelay, MAX_RETRIES } from './retry'

export interface SyncContext {
  orgId: string
  userId: string
}

type LocalSyncRecord = {
  record_id: string
  sync_status: string
}

let activeSyncCycle: Promise<void> | null = null

export async function runSyncCycle(
  database: any,
  supabaseClient: any,
  context: SyncContext
): Promise<void> {
  if (activeSyncCycle) {
    return activeSyncCycle
  }

  activeSyncCycle = runSyncCycleInternal(database, supabaseClient, context)
  try {
    await activeSyncCycle
  } finally {
    activeSyncCycle = null
  }
}

async function runSyncCycleInternal(
  database: any,
  supabaseClient: any,
  context: SyncContext
): Promise<void> {
  const pending = await getPendingRecords(database)
  for (const record of pending) {
    let success = false
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await uploadRecord(supabaseClient, {
          recordId: record.record_id,
          orgId: context.orgId,
          userId: context.userId,
          formType: record.form_type,
          encryptedData: record.encrypted_data,
          hasPhoto: record.has_photo,
          createdAt: new Date(record.created_at).toISOString(),
        })

        if (record.has_photo && record.encrypted_photo) {
          await uploadPhoto(supabaseClient, {
            recordId: record.record_id,
            orgId: context.orgId,
            encryptedBlob: record.encrypted_photo,
          })
        }

        success = true
        break
      } catch (error) {
        if (isDuplicateUploadError(error)) {
          console.warn('[sync] record already exists remotely; marking local row synced:', record.record_id)
          success = true
          break
        }

        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn('[sync] upload attempt failed:', lastError.message)
        if (attempt < MAX_RETRIES) {
          const delay = getRetryDelay(attempt)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    if (success) {
      try {
        await markSynced(database, record.id)
      } catch (e) {
        console.error('[sync] markSynced threw:', e)
      }
    } else {
      console.error('[sync] giving up on record', record.record_id, lastError?.message)
      await markFailed(database, record.id)
    }
  }

  const recordsCollection = database.collections.get('records')
  const latestRecords = (await recordsCollection.query().fetch()) as LocalSyncRecord[]
  const syncedRecordIds = new Set(
    latestRecords
      .filter((record) => record.sync_status === 'synced')
      .map((record) => record.record_id)
  )

  const pendingAiChecks = await getPendingAiChecks(database)
  for (const aiCheck of pendingAiChecks) {
    if (!syncedRecordIds.has(aiCheck.record_id)) {
      continue
    }

    let success = false
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await uploadAiCheck(supabaseClient, {
          aiCheckId: aiCheck.ai_check_id,
          recordId: aiCheck.record_id,
          orgId: context.orgId,
          userId: context.userId,
          encryptedAnalysis: aiCheck.encrypted_analysis,
          createdAt: new Date(aiCheck.created_at).toISOString(),
        })

        success = true
        break
      } catch (error) {
        if (isDuplicateUploadError(error)) {
          console.warn('[sync] AI check already exists remotely; marking local row synced:', aiCheck.ai_check_id)
          success = true
          break
        }

        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn('[sync] AI check upload attempt failed:', lastError.message)
        if (attempt < MAX_RETRIES) {
          const delay = getRetryDelay(attempt)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    if (success) {
      try {
        await markAiCheckSynced(database, aiCheck.id)
      } catch (e) {
        console.error('[sync] markAiCheckSynced threw:', e)
      }
    } else {
      console.error('[sync] giving up on AI check', aiCheck.ai_check_id, lastError?.message)
      await markAiCheckFailed(database, aiCheck.id)
    }
  }
}
