import { SupabaseClient } from '@supabase/supabase-js'

export class SyncUploadError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message)
    this.name = 'SyncUploadError'
  }
}

export function isDuplicateUploadError(error: unknown): boolean {
  return error instanceof SyncUploadError && error.code === '23505'
}

export async function uploadRecord(
  supabaseClient: SupabaseClient,
  record: {
    recordId: string
    orgId: string
    userId: string
    formType: string
    encryptedData: string
    hasPhoto: boolean
    createdAt: string
  }
): Promise<void> {
  const { error } = await supabaseClient.from('encrypted_records').insert({
    record_id: record.recordId,
    org_id: record.orgId,
    user_id: record.userId,
    form_type: record.formType,
    encrypted_data: record.encryptedData,
    has_photo: record.hasPhoto,
    created_at: record.createdAt,
  })
  if (error) {
    throw new SyncUploadError(`Upload failed: ${error.message}`, error.code)
  }
}

export async function uploadPhoto(
  supabaseClient: SupabaseClient,
  photo: {
    recordId: string
    orgId: string
    encryptedBlob: string
  }
): Promise<void> {
  const { error } = await supabaseClient.from('encrypted_photos').insert({
    record_id: photo.recordId,
    org_id: photo.orgId,
    encrypted_blob: photo.encryptedBlob,
  })
  if (error) {
    throw new SyncUploadError(`Photo upload failed: ${error.message}`, error.code)
  }
}

export async function uploadAiCheck(
  supabaseClient: SupabaseClient,
  aiCheck: {
    aiCheckId: string
    recordId: string
    orgId: string
    userId: string
    encryptedAnalysis: string
    createdAt: string
  }
): Promise<void> {
  const { error } = await supabaseClient.from('encrypted_record_ai_checks').insert({
    ai_check_id: aiCheck.aiCheckId,
    record_id: aiCheck.recordId,
    org_id: aiCheck.orgId,
    user_id: aiCheck.userId,
    encrypted_analysis: aiCheck.encryptedAnalysis,
    created_at: aiCheck.createdAt,
  })
  if (error) {
    throw new SyncUploadError(`AI check upload failed: ${error.message}`, error.code)
  }
}
