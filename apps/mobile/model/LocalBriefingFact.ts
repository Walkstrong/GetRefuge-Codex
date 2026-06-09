import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class LocalBriefingFact extends Model {
  static table = 'local_briefing_facts'

  @field('fact_id') fact_id!: string
  @field('record_id') record_id!: string
  @field('form_type') form_type!: string
  @field('severity_bucket') severity_bucket!: string
  @field('need_categories') need_categories!: string
  @field('has_children') has_children!: boolean
  @field('has_protection_concern') has_protection_concern!: boolean
  @field('affected_count') affected_count?: number
  @field('created_at') created_at!: number
}
