export async function getPendingRecords(database: any): Promise<any[]> {
  const recordsCollection = database.collections.get('records')
  const records = await recordsCollection.query().fetch()
  return records.filter((record: any) => record.sync_status === 'pending')
}

export async function getPendingAiChecks(database: any): Promise<any[]> {
  const aiChecksCollection = database.collections.get('record_ai_checks')
  const aiChecks = await aiChecksCollection.query().fetch()
  return aiChecks.filter((aiCheck: any) => aiCheck.sync_status === 'pending')
}

export async function markSynced(database: any, recordId: string): Promise<void> {
  await database.write(async () => {
    const recordsCollection = database.collections.get('records')
    const record = await recordsCollection.find(recordId)
    await record.update((r: any) => {
      r.sync_status = 'synced'
      r.synced_at = Date.now()
    })
  })
}

export async function markAiCheckSynced(database: any, aiCheckId: string): Promise<void> {
  await database.write(async () => {
    const aiChecksCollection = database.collections.get('record_ai_checks')
    const aiCheck = await aiChecksCollection.find(aiCheckId)
    await aiCheck.update((check: any) => {
      check.sync_status = 'synced'
      check.synced_at = Date.now()
    })
  })
}

export async function markFailed(database: any, recordId: string): Promise<void> {
  await database.write(async () => {
    const recordsCollection = database.collections.get('records')
    const record = await recordsCollection.find(recordId)
    await record.update((r: any) => {
      r.sync_status = 'failed'
    })
  })
}

export async function markAiCheckFailed(database: any, aiCheckId: string): Promise<void> {
  await database.write(async () => {
    const aiChecksCollection = database.collections.get('record_ai_checks')
    const aiCheck = await aiChecksCollection.find(aiCheckId)
    await aiCheck.update((check: any) => {
      check.sync_status = 'failed'
    })
  })
}
