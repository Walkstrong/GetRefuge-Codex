import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { DecryptedRecord } from '../src/routes/dashboard'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1f2937',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
  },
  headerMeta: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginTop: 20,
    marginBottom: 10,
    backgroundColor: '#f3f4f6',
    padding: 8,
  },
  recordBlock: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  fieldName: {
    width: '40%',
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
  },
  fieldValue: {
    width: '60%',
    color: '#4b5563',
  },
})

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return value.join(', ')
  }
  if (typeof value === 'string') {
    if (value.trim() === '') return null
    return value
  }
  return String(value)
}

interface PdfReportProps {
  records: DecryptedRecord[]
  orgName?: string
}

export function PdfReport({ records, orgName }: PdfReportProps) {
  const today = new Date().toISOString().slice(0, 10)

  const incidentRecords = records.filter((r) => r.form_type === 'incident')
  const beneficiaryRecords = records.filter((r) => r.form_type === 'beneficiary')

  const renderRecord = (record: DecryptedRecord) => {
    const entries = Object.entries(record)
      .filter(([key]) => key !== 'id' && key !== 'form_type')
      .map(([key, value]) => ({ key, value: formatValue(value) }))
      .filter((entry) => entry.value !== null)

    return (
      <View key={record.id || record.record_id} style={styles.recordBlock}>
        {entries.map(({ key, value }) => (
          <View key={key} style={styles.fieldRow}>
            <Text style={styles.fieldName}>{key}</Text>
            <Text style={styles.fieldValue}>{value}</Text>
          </View>
        ))}
      </View>
    )
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {orgName ? `${orgName} - ` : ''}GetRefuge - M&E Report
          </Text>
          <Text style={styles.headerMeta}>Generated on {today}</Text>
        </View>

        {incidentRecords.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>
              Incident Reports ({incidentRecords.length})
            </Text>
            {incidentRecords.map(renderRecord)}
          </View>
        )}

        {beneficiaryRecords.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>
              Beneficiary Interviews ({beneficiaryRecords.length})
            </Text>
            {beneficiaryRecords.map(renderRecord)}
          </View>
        )}

        {records.length === 0 && (
          <Text style={{ marginTop: 20, color: '#6b7280' }}>
            No records to display.
          </Text>
        )}
      </Page>
    </Document>
  )
}
