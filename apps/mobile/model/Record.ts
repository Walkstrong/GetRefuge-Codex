import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class Record extends Model {
  static table = 'records'

  // Fields
  @field('record_id') record_id!: string
  @field('form_type') form_type!: string
  @field('encrypted_data') encrypted_data!: string
  @field('has_photo') has_photo!: boolean
  @field('encrypted_photo') encrypted_photo?: string
  @field('sync_status') sync_status!: string
  @field('created_at') created_at!: number
  @field('updated_at') updated_at!: number
  @field('synced_at') synced_at?: number
}
