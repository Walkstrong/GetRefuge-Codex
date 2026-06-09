import * as React from 'react'
import { cn } from '@/lib/utils'

interface TableProps {
  children: React.ReactNode
  className?: string
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, children }, ref) => {
    return (
      <table
        ref={ref}
        className={cn('w-full text-sm text-left rtl:text-right border-collapse', className)}
      >
        {children}
      </table>
    )
  }
)
Table.displayName = 'Table'

interface TableHeaderProps {
  children: React.ReactNode
}
export const TableHeader = ({ children }: TableHeaderProps) => {
  return (
    <thead className={cn('bg-muted')}>
      <tr>{children}</tr>
    </thead>
  )
}

interface TableBodyProps {
  children: React.ReactNode
}
export const TableBody = ({ children }: TableBodyProps) => <tbody>{children}</tbody>

interface TableFooterProps {
  children: React.ReactNode
}
export const TableFooter = ({ children }: TableFooterProps) => <tfoot>{children}</tfoot>

interface TableRowProps {
  children: React.ReactNode
  className?: string
}
export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, children }, ref) => (
    <tr ref={ref} className={className}>
      {children}
    </tr>
  )
)
TableRow.displayName = 'TableRow'

interface TableHeadProps {
  children: React.ReactNode
  className?: string
}
export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, children }, ref) => (
    <th
      ref={ref}
      scope="col"
      className={cn(
        'px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider',
        className
      )}
    >
      {children}
    </th>
  )
)
TableHead.displayName = 'TableHead'

interface TableCellProps {
  children: React.ReactNode
  className?: string
}
export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, children }, ref) => (
    <td
      ref={ref}
      className={cn('px-6 py-4 whitespace-nowrap text-sm text-foreground', className)}
    >
      {children}
    </td>
  )
)
TableCell.displayName = 'TableCell'
