import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const schema = appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'records',
      columns: [
        { name: 'record_id', type: 'string' },
        { name: 'form_type', type: 'string' },
        { name: 'encrypted_data', type: 'string' },
        { name: 'has_photo', type: 'boolean' },
        { name: 'encrypted_photo', type: 'string', isOptional: true },
        { name: 'sync_status', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'record_ai_checks',
      columns: [
        { name: 'ai_check_id', type: 'string' },
        { name: 'record_id', type: 'string' },
        { name: 'encrypted_analysis', type: 'string' },
        { name: 'sync_status', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'local_briefing_facts',
      columns: [
        { name: 'fact_id', type: 'string' },
        { name: 'record_id', type: 'string' },
        { name: 'form_type', type: 'string' },
        { name: 'severity_bucket', type: 'string' },
        { name: 'need_categories', type: 'string' },
        { name: 'has_children', type: 'boolean' },
        { name: 'has_protection_concern', type: 'boolean' },
        { name: 'affected_count', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'settings',
      columns: [
        { name: 'key', type: 'string' },
        { name: 'value', type: 'string' },
      ],
    }),
  ],
})
