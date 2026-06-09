import { useState, useEffect, useCallback, useRef } from 'react'
import { database } from '../database'
import { useConnectivity } from './useConnectivity'
import { runSyncCycle, SyncState } from '@getrefuge/sync'
import { supabase } from '../lib/supabase'

function isNetworkRequestFailure(error: unknown): boolean {
  return error instanceof TypeError && error.message === 'Network request failed'
}

async function getLocalSyncCounts(): Promise<{ pendingCount: number; failedCount: number }> {
  const records = database.collections.get('records')
  const aiChecks = database.collections.get('record_ai_checks')
  const all = await records.query().fetch()
  const allAiChecks = await aiChecks.query().fetch()
  const pendingRecordCount = all.filter((r: any) => r.sync_status === 'pending').length
  const pendingAiCheckCount = allAiChecks.filter((check: any) => check.sync_status === 'pending').length
  const failedRecordCount = all.filter((r: any) => r.sync_status === 'failed').length
  const failedAiCheckCount = allAiChecks.filter((check: any) => check.sync_status === 'failed').length

  return {
    pendingCount: pendingRecordCount + pendingAiCheckCount,
    failedCount: failedRecordCount + failedAiCheckCount,
  }
}

export function useSync(): SyncState & { triggerSync: () => Promise<void> } {
  const isOnline = useConnectivity()
  const [state, setState] = useState<SyncState>({
    lastSync: null,
    pendingCount: 0,
    failedCount: 0,
    isOnline,
    isSyncing: false,
  })
  const stateRef = useRef(state)
  stateRef.current = state

  const triggerSync = useCallback(async () => {
    if (!isOnline || stateRef.current.isSyncing) return
    setState((prev) => ({ ...prev, isSyncing: true }))
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData?.session
      if (!session?.user) {
        setState((prev) => ({ ...prev, isSyncing: false }))
        return
      }

      const { data: userRow, error: userErr } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', session.user.id)
        .single()

      if (userErr || !userRow?.org_id) {
        if (isNetworkRequestFailure(userErr)) {
          setState((prev) => ({ ...prev, isOnline: false, isSyncing: false }))
          return
        }
        console.warn('[sync] could not resolve org_id:', userErr?.message)
        setState((prev) => ({ ...prev, isSyncing: false }))
        return
      }

      await runSyncCycle(database, supabase, {
        orgId: userRow.org_id,
        userId: session.user.id,
      })

      const counts = await getLocalSyncCounts()
      setState((prev) => ({
        ...prev,
        ...counts,
        lastSync: Date.now(),
        isSyncing: false,
      }))
    } catch (e) {
      if (isNetworkRequestFailure(e)) {
        setState((prev) => ({ ...prev, isOnline: false, isSyncing: false }))
        return
      }
      console.warn('[sync] cycle error:', e)
      setState((prev) => ({ ...prev, isSyncing: false }))
    }
  }, [isOnline])

  useEffect(() => {
    if (isOnline) {
      triggerSync()
    }
    setState((prev) => ({ ...prev, isOnline }))
  }, [isOnline, triggerSync])

  useEffect(() => {
    if (isOnline && state.pendingCount > 0 && !state.isSyncing) {
      triggerSync()
    }
  }, [isOnline, state.pendingCount, state.isSyncing, triggerSync])

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const counts = await getLocalSyncCounts()
        if (!cancelled) {
          setState((prev) => ({ ...prev, ...counts }))
        }
      } catch {
        // ignore
      }
    }
    poll()
    const interval = setInterval(poll, 1500)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return { ...state, triggerSync }
}
