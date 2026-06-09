import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { schema } from './schema'
import { migrations } from './migrations'
import Record from '../model/Record'
import RecordAiCheck from '../model/RecordAiCheck'
import LocalBriefingFact from '../model/LocalBriefingFact'

// TODO: Add model classes when they are defined (e.g., Record, Setting)
const adapter = new SQLiteAdapter({
  schema,
  migrations,
  // jsi: true, // TODO: enable JSI for faster synchronous operations if supported
  onSetUpError: (error) => {
    // TODO: handle setup error (e.g., corrupted database)
    console.error('Database setup error:', error)
  },
})

export const database = new Database({
  adapter,
  modelClasses: [Record, RecordAiCheck, LocalBriefingFact],
})
