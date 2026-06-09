import { useCallback } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet } from 'lucide-react'
import { buildWorkbook } from '../lib/excelExport'
import type { DecryptedRecord } from '../src/routes/dashboard'

interface ExportExcelProps {
  records: DecryptedRecord[]
  label?: string
}

export default function ExportExcel({ records, label }: ExportExcelProps) {
  const handleClick = useCallback(() => {
    const workbook = buildWorkbook(records)
    const filename = `getrefuge-records-${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(workbook, filename)
  }, [records])

  return (
    <button
      onClick={handleClick}
      className={
        label
          ? 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors disabled:opacity-50'
          : 'rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted'
      }
      aria-label={label ? undefined : 'Export to Excel'}
      disabled={records.length === 0}
      type="button"
    >
      <FileSpreadsheet className="w-4 h-4 shrink-0" />
      {label && <span>{label}</span>}
    </button>
  )
}
