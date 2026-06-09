import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class RecordAiCheck extends Model {
  static table = 'record_ai_checks'

  @field('ai_check_id') ai_check_id!: string
  @field('record_id') record_id!: string
  @field('encrypted_analysis') encrypted_analysis!: string
  @field('sync_status') sync_status!: string
  @field('created_at') created_at!: number
  @field('synced_at') synced_at?: number
}
