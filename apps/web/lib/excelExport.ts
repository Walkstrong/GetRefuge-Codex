import * as XLSX from 'xlsx'
import type { DecryptedRecord } from '../src/routes/dashboard'
import { incidentSchema, beneficiarySchema } from '@getrefuge/shared-schema'

export function buildWorkbook(records: DecryptedRecord[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new()

  const incidentFields = Object.keys(incidentSchema.shape)
  const beneficiaryFields = Object.keys(beneficiarySchema.shape)

  const incidentRecords = records.filter((r) => r.form_type === 'incident')
  const beneficiaryRecords = records.filter((r) => r.form_type === 'beneficiary')

  function renderCell(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'string' && value.trim() === '') return ''
    return String(value)
  }

  function buildSheet(fields: string[], data: DecryptedRecord[]): XLSX.WorkSheet {
    const rows: unknown[][] = [fields]
    for (const record of data) {
      const row = fields.map((field) => renderCell(record[field]))
      rows.push(row)
    }
    return XLSX.utils.aoa_to_sheet(rows)
  }

  if (incidentRecords.length > 0) {
    const incidentSheet = buildSheet(incidentFields, incidentRecords)
    XLSX.utils.book_append_sheet(workbook, incidentSheet, 'Incidents')
  }

  if (beneficiaryRecords.length > 0) {
    const beneficiarySheet = buildSheet(beneficiaryFields, beneficiaryRecords)
    XLSX.utils.book_append_sheet(workbook, beneficiarySheet, 'Beneficiaries')
  }

  return workbook
}
