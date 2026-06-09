import { useCallback } from 'react'
import { pdf } from '@react-pdf/renderer'
import { FileText } from 'lucide-react'
import { PdfReport } from '../lib/pdfTemplate'
import type { DecryptedRecord } from '../src/routes/dashboard'

interface ExportPdfProps {
  records: DecryptedRecord[]
  orgName?: string
  label?: string
}

export default function ExportPdf({ records, orgName, label }: ExportPdfProps) {
  const handleClick = useCallback(async () => {
    const blob = await pdf(<PdfReport records={records} orgName={orgName} />).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `getrefuge-report-${new Date().toISOString().slice(0, 10)}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }, [records, orgName])

  return (
    <button
      onClick={handleClick}
      className={
        label
          ? 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors disabled:opacity-50'
          : 'rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted'
      }
      aria-label={label ? undefined : 'Export to PDF'}
      disabled={records.length === 0}
      type="button"
    >
      <FileText className="w-4 h-4 shrink-0" />
      {label && <span>{label}</span>}
    </button>
  )
}
