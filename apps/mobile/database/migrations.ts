import { createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations'

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        createTable({
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
      ],
    },
    {
      toVersion: 3,
      steps: [
        createTable({
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
      ],
    },
  ],
})
