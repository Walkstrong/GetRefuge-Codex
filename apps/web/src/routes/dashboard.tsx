import {
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { ChatPanel } from '@/components/ChatPanel'
import { CustomReportsPanel } from '@/components/CustomReportsPanel'
import { FormStudioPanel } from '@/components/FormStudioPanel'
import { MapView } from '@/components/MapView'
import ExportPdf from '../../components/ExportPdf'
import ExportExcel from '../../components/ExportExcel'
import type { DecryptedRecord as QueryExecutorDecryptedRecord } from '@/lib/queryExecutor'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
import { deriveKeyFromPassphrase, decryptRecord } from '@getrefuge/crypto'
import { encodeBase64 } from 'tweetnacl-util'
import { Table } from '@/components/ui/table'
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownUp,
  BarChart3,
  ClipboardList,
  FileText,
  Filter,
  GripVertical,
  Inbox,
  Loader2,
  MapPinned,
  MessageSquare,
  Monitor,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  Table2,
  X,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type DecryptedRecord = {
  id: string
  record_id: string
  form_type: 'incident' | 'beneficiary'
  created_at: string
  [key: string]: unknown
}

type DashboardRole = 'admin' | 'manager' | 'analyst' | 'field_worker' | string

type EncryptedRecordRow = {
  id: string
  record_id: string
  form_type: 'incident' | 'beneficiary'
  created_at: string
  encrypted_data?: unknown
}

type DashboardView = 'overview' | 'records' | 'reports' | 'forms'
type SeverityLevel = 'low' | 'medium' | 'high' | 'critical'
type ThemeMode = 'auto' | 'light' | 'dark'
type SortDirection = 'asc' | 'desc'
type ChartWidgetId = 'incident-types' | 'primary-needs' | 'regional-pressure'
type OverviewSectionId = 'filters' | 'map' | 'charts' | 'severity'
type DashboardTheme = CSSProperties & Record<`--${string}`, string>

type ActiveFilterChip = {
  id: string
  label: string
  onClear: () => void
}

type ChartHoverDatum = {
  label: string
  value: string
}

const HQ_DASHBOARD_ROLES = new Set(['admin', 'manager', 'analyst'])

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  low: '#4F8FE8',
  medium: '#D69C38',
  high: '#F27A57',
  critical: '#C74343',
}

const CHART_COLORS = [
  '#6BA5B4',
  '#76B08A',
  '#F2A56F',
  '#D96C75',
  '#8FA4F2',
  '#6ECAD0',
  '#B6A2E3',
  '#D6B84D',
]

const THEME_OPTIONS: Array<{
  mode: ThemeMode
  label: string
  icon: ComponentType<{ className?: string }>
}> = [
  { mode: 'auto', label: 'Auto', icon: Monitor },
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
]

const PASTEL_LIGHT_THEME = {
  '--color-background': '#F7FBFA',
  '--color-foreground': '#102A2E',
  '--color-primary': '#2F7C87',
  '--color-primary-foreground': '#FFFFFF',
  '--color-secondary': '#E8F5F1',
  '--color-secondary-foreground': '#143236',
  '--color-muted': '#EAF6F3',
  '--color-muted-foreground': '#587074',
  '--color-accent': '#FFE2D6',
  '--color-accent-foreground': '#54271A',
  '--color-card': '#FFFFFF',
  '--color-card-foreground': '#102A2E',
  '--color-border': '#D6E8E4',
  '--color-input': '#C9DFDA',
  '--color-ring': '#2F7C87',
  '--dash-warm-terra': '#F27A57',
  '--dash-warm-border': '#D6E8E4',
  '--dash-map-water': '#BFE7E3',
  '--dash-soft-blue': '#BFE7E3',
  '--dash-soft-green': '#A8D5BA',
  '--dash-soft-coral': '#FFB3A7',
} as DashboardTheme

const PASTEL_DARK_THEME = {
  '--color-background': '#102225',
  '--color-foreground': '#EFF8F6',
  '--color-primary': '#8ED5D0',
  '--color-primary-foreground': '#0F2427',
  '--color-secondary': '#173235',
  '--color-secondary-foreground': '#DDEDE9',
  '--color-muted': '#183336',
  '--color-muted-foreground': '#A9C2BF',
  '--color-accent': '#442B28',
  '--color-accent-foreground': '#FFE2D6',
  '--color-card': '#142A2D',
  '--color-card-foreground': '#EFF8F6',
  '--color-border': '#2B4A4C',
  '--color-input': '#2B4A4C',
  '--color-ring': '#8ED5D0',
  '--dash-warm-terra': '#FF9A76',
  '--dash-warm-border': '#2B4A4C',
  '--dash-map-water': '#31595C',
  '--dash-soft-blue': '#5FAFBC',
  '--dash-soft-green': '#77B98D',
  '--dash-soft-coral': '#FF9A8B',
} as DashboardTheme

function isHqDashboardRole(role: DashboardRole | null): boolean {
  return role !== null && HQ_DASHBOARD_ROLES.has(role)
}

function formatDashboardRole(role: DashboardRole | null): string {
  if (!role) return 'Unknown'
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function isSeverityLevel(value: string): value is SeverityLevel {
  return ['low', 'medium', 'high', 'critical'].includes(value)
}

function getStringValue(record: DecryptedRecord, field: string): string | null {
  const value = record[field]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function getNumberValue(record: DecryptedRecord, field: string): number {
  const value = record[field]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getStringArray(record: DecryptedRecord, field: string): string[] {
  const value = record[field]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function titleize(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

type ChartTooltipPayload = {
  name?: unknown
  value?: unknown
  payload?: Record<string, unknown>
}

type RechartsHoverState = {
  isTooltipActive?: boolean
  activeLabel?: unknown
  activePayload?: ChartTooltipPayload[]
}

function getTooltipName(
  payload: ChartTooltipPayload | undefined,
  fallback: unknown,
): string {
  const row = payload?.payload
  const value =
    row?.incidentType ??
    row?.need ??
    row?.region ??
    row?.severity ??
    row?.name ??
    fallback ??
    payload?.name ??
    'Value'

  return titleize(String(value))
}

function CompactChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: ChartTooltipPayload[]
  label?: unknown
}) {
  if (!active || !payload?.length) return null

  const first = payload[0]
  const value = first.value

  return (
    <div className="rounded-md border border-[var(--dash-warm-border)] bg-card px-3 py-2 text-xs text-card-foreground shadow-lg">
      <p className="mb-1 font-semibold text-foreground">
        {getTooltipName(first, label)}
      </p>
      <p className="text-muted-foreground">
        Count:{' '}
        <span className="font-semibold text-foreground">
          {typeof value === 'number' ? value.toLocaleString() : String(value)}
        </span>
      </p>
    </div>
  )
}

function CompactChartTooltip() {
  return (
    <Tooltip
      allowEscapeViewBox={{ x: true, y: true }}
      content={<CompactChartTooltipContent />}
      cursor={{ fill: 'rgba(47, 124, 135, 0.08)' }}
      wrapperStyle={{ zIndex: 50, outline: 'none' }}
    />
  )
}

function getChartHoverDatum(state: RechartsHoverState): ChartHoverDatum | null {
  if (!state.isTooltipActive || !state.activePayload?.length) return null

  const first = state.activePayload[0]
  const row = first.payload
  const label =
    row?.incidentType ??
    row?.need ??
    row?.region ??
    row?.severity ??
    row?.name ??
    state.activeLabel ??
    first.name
  const value = first.value ?? row?.count ?? row?.value

  if (label === undefined || value === undefined) return null

  return {
    label: titleize(String(label)),
    value: typeof value === 'number' ? value.toLocaleString() : String(value),
  }
}

function ChartHoverReadout({ datum }: { datum: ChartHoverDatum | null }) {
  return (
    <div className="mb-2 flex min-h-8 justify-end">
      {datum ? (
        <div className="inline-flex items-center gap-2 rounded-md border border-[var(--dash-warm-border)] bg-card px-3 py-1.5 text-xs text-card-foreground shadow-sm">
          <span className="font-semibold text-foreground">{datum.label}</span>
          <span className="text-muted-foreground">Count</span>
          <span className="font-semibold text-primary">{datum.value}</span>
        </div>
      ) : null}
    </div>
  )
}

function formatDateInputLabel(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function DashboardTabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ComponentType<{ className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-transparent bg-slate-900 text-white'
          : 'border-[var(--dash-warm-border)] bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  label: string
  value: string | number
  detail: string
  icon: ComponentType<{ className?: string }>
  accent: string
}) {
  return (
    <div className="rounded-lg border border-[var(--dash-warm-border)] bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {value}
          </p>
        </div>
        <div
          className="rounded-md p-2"
          style={{ backgroundColor: `${accent}1A`, color: accent }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function ActiveFilterPill({ chip }: { chip: ActiveFilterChip }) {
  return (
    <button
      type="button"
      onClick={chip.onClear}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dash-warm-border)] bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
      title="Remove filter"
    >
      {chip.label}
      <X className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  )
}

function ThemeModeControl({
  mode,
  onChange,
}: {
  mode: ThemeMode
  onChange: (mode: ThemeMode) => void
}) {
  return (
    <div
      className="inline-flex rounded-md border border-[var(--dash-warm-border)] bg-card p-1 shadow-sm"
      aria-label="Theme mode"
    >
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon
        const active = mode === option.mode
        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => onChange(option.mode)}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            aria-pressed={active}
            title={`${option.label} theme`}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function sortData<T extends { count?: number; value?: number }>(
  data: T[],
  direction: SortDirection,
): T[] {
  return [...data].sort((a, b) => {
    const aValue = a.count ?? a.value ?? 0
    const bValue = b.count ?? b.value ?? 0
    return direction === 'asc' ? aValue - bValue : bValue - aValue
  })
}

function ChartToolbar({
  sortDirection,
  onToggleSort,
  onReset,
  resetDisabled,
}: {
  sortDirection: SortDirection
  onToggleSort: () => void
  onReset: () => void
  resetDisabled: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onToggleSort}
        className="inline-flex items-center gap-1 rounded-md border border-[var(--dash-warm-border)] px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Arrange chart order"
      >
        <ArrowDownUp className="h-3.5 w-3.5" />
        {sortDirection === 'desc' ? 'High' : 'Low'}
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={resetDisabled}
        className="rounded-md border border-[var(--dash-warm-border)] px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        Reset
      </button>
    </div>
  )
}

function SortableChartCard({
  id,
  children,
}: {
  id: ChartWidgetId
  children: ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
      }}
      className="relative rounded-lg border border-[var(--dash-warm-border)] bg-card p-5 shadow-sm"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Drag to rearrange"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  )
}

function SortableOverviewSection({
  id,
  children,
  disabled,
}: {
  id: OverviewSectionId
  children: ReactNode
  disabled: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.75 : 1,
      }}
      className="relative"
    >
      {!disabled ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute right-3 top-3 z-20 rounded-md border border-[var(--dash-warm-border)] bg-card p-1.5 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
          title="Drag section"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : null}
      {children}
    </div>
  )
}

const ANALYST_LAUNCHER_SIZE = { width: 180, height: 54 }
const ANALYST_LAUNCHER_MARGIN = 16

type AnalystLauncherPosition = {
  x: number
  y: number
}

type AnalystLauncherDragState = {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}

function clampAnalystLauncherPosition(
  position: AnalystLauncherPosition,
): AnalystLauncherPosition {
  if (typeof window === 'undefined') return position
  const maxX = Math.max(
    ANALYST_LAUNCHER_MARGIN,
    window.innerWidth - ANALYST_LAUNCHER_SIZE.width - ANALYST_LAUNCHER_MARGIN,
  )
  const maxY = Math.max(
    ANALYST_LAUNCHER_MARGIN,
    window.innerHeight - ANALYST_LAUNCHER_SIZE.height - ANALYST_LAUNCHER_MARGIN,
  )
  return {
    x: clampNumber(position.x, ANALYST_LAUNCHER_MARGIN, maxX),
    y: clampNumber(position.y, ANALYST_LAUNCHER_MARGIN, maxY),
  }
}

function defaultAnalystLauncherPosition(): AnalystLauncherPosition {
  if (typeof window === 'undefined') return { x: ANALYST_LAUNCHER_MARGIN, y: ANALYST_LAUNCHER_MARGIN }
  return clampAnalystLauncherPosition({
    x: window.innerWidth - ANALYST_LAUNCHER_SIZE.width - 24,
    y: window.innerHeight - ANALYST_LAUNCHER_SIZE.height - 24,
  })
}

function DraggableAnalystLauncher({ onOpen }: { onOpen: () => void }) {
  const [position, setPosition] = useState<AnalystLauncherPosition>(() =>
    defaultAnalystLauncherPosition(),
  )
  const dragStateRef = useRef<AnalystLauncherDragState | null>(null)

  useEffect(() => {
    setPosition(defaultAnalystLauncherPosition())
  }, [])

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => clampAnalystLauncherPosition(current))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return
    const deltaX = event.clientX - dragState.startX
    const deltaY = event.clientY - dragState.startY
    const moved = dragState.moved || Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4
    dragStateRef.current = { ...dragState, moved }
    setPosition(
      clampAnalystLauncherPosition({
        x: dragState.originX + deltaX,
        y: dragState.originY + deltaY,
      }),
    )
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current
    dragStateRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!dragState?.moved) onOpen()
  }

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragStateRef.current = null
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      className="fixed z-[1000] inline-flex max-w-[calc(100vw-2rem)] cursor-grab touch-none items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-xl transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 active:cursor-grabbing"
      style={{
        left: position.x,
        top: position.y,
      }}
      aria-label="Open AI Analyst. Drag to move."
      title="Drag to move, click to open"
    >
      <GripVertical className="h-4 w-4 opacity-80" />
      <MessageSquare className="h-4 w-4" />
      AI Analyst
    </button>
  )
}

// --- Helpers ---
function formatTimeAgo(date: Date | null): string {
  if (!date) return ''
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `Updated ${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Updated ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Updated ${hours}h ago`
  const days = Math.floor(hours / 24)
  return `Updated ${days}d ago`
}

function getRecordDateInput(record: DecryptedRecord): string | number | Date {
  const candidate =
    record.reportDate ??
    record.interviewDate ??
    record.incidentDate ??
    record.created_at
  return typeof candidate === 'string' || typeof candidate === 'number'
    ? candidate
    : record.created_at
}

// --- Pagination ---
function Pagination({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  totalRecords: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  if (totalRecords === 0) return null

  const startRecord = (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, totalRecords)

  const getPageNumbers = (): (number | 'ellipsis-start' | 'ellipsis-end')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const items: (number | 'ellipsis-start' | 'ellipsis-end')[] = []
    let windowStart = currentPage - 2
    let windowEnd = currentPage + 2
    if (windowStart <= 2) {
      windowStart = 2
      windowEnd = Math.max(windowEnd, Math.min(6, totalPages - 1))
    }
    if (windowEnd >= totalPages - 1) {
      windowEnd = totalPages - 1
      windowStart = Math.min(windowStart, Math.max(totalPages - 5, 2))
    }
    items.push(1)
    if (windowStart > 2) items.push('ellipsis-start')
    for (let i = windowStart; i <= windowEnd; i++) items.push(i)
    if (windowEnd < totalPages - 1) items.push('ellipsis-end')
    items.push(totalPages)
    return items
  }

  const pageNums = getPageNumbers()
  const navBtn =
    'px-2 py-1 rounded border border-[var(--dash-warm-border)] text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--dash-warm-terra)]/40 disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="flex flex-wrap items-center justify-between mt-4 gap-3">
      {totalPages > 1 && (
        <div className="flex items-center gap-2 sm:hidden">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={navBtn}
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={navBtn}
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      )}

      {totalPages > 1 && (
        <div className="hidden sm:flex items-center gap-1">
          <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className={navBtn} aria-label="First page">«</button>
          <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className={navBtn} aria-label="Previous page">‹</button>
          {pageNums.map((p) =>
            typeof p === 'string' ? (
              <span key={p} className="px-1 text-xs text-muted-foreground select-none">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                aria-current={currentPage === p ? 'page' : undefined}
                className={`px-3 py-1 rounded border text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--dash-warm-terra)]/40 ${
                  currentPage === p
                    ? 'text-white border-transparent'
                    : 'border-[var(--dash-warm-border)] text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                style={currentPage === p ? { backgroundColor: 'var(--dash-warm-terra)', borderColor: 'var(--dash-warm-terra)' } : {}}
              >
                {p}
              </button>
            )
          )}
          <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className={navBtn} aria-label="Next page">›</button>
          <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className={navBtn} aria-label="Last page">»</button>
        </div>
      )}

      <span className="text-sm text-muted-foreground sm:ml-auto">
        Showing {startRecord}–{endRecord} of {totalRecords}
      </span>
    </div>
  )
}

// --- Dashboard Page ---
export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const navigate = useNavigate()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgPublicKey, setOrgPublicKey] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<DashboardRole | null>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate({ to: '/login' })
        return
      }
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('org_id, role')
        .eq('id', user.id)
        .single()
      if (profileError || !profile?.org_id) {
        navigate({ to: '/login' })
        return
      }

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('public_key')
        .eq('id', profile.org_id)
        .single()
      if (orgError || !org?.public_key) {
        navigate({ to: '/login' })
        return
      }

      setOrgId(profile.org_id)
      setOrgPublicKey(typeof org.public_key === 'string' ? org.public_key : null)
      setUserRole(typeof profile.role === 'string' ? profile.role : 'field_worker')
      setSessionChecked(true)
    }
    fetchSession()
  }, [navigate])

  useEffect(() => {
    const updateViewport = () => {
      setIsMobileViewport(window.matchMedia('(max-width: 767px)').matches)
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updatePreference = () => setPrefersDarkTheme(media.matches)
    updatePreference()
    media.addEventListener('change', updatePreference)
    return () => media.removeEventListener('change', updatePreference)
  }, [])

  const [passphrase, setPassphrase] = useState('')
  const [key, setKey] = useState<{ publicKey: Uint8Array; secretKey: Uint8Array } | null>(null)
  const [encryptedRecords, setEncryptedRecords] = useState<EncryptedRecordRow[]>([])
  const [decryptedRecords, setDecryptedRecords] = useState<DecryptedRecord[]>([])
  const [chatOpen, setChatOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null)
  const [failedDecryptions, setFailedDecryptions] = useState<{ id: string; record_id: string }[]>([])
  const [retryCount, setRetryCount] = useState(0)
  const [timeAgoTick, setTimeAgoTick] = useState(0)
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar')
  const [activeView, setActiveView] = useState<DashboardView>('overview')
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto')
  const [prefersDarkTheme, setPrefersDarkTheme] = useState(false)
  const [incidentSortDirection, setIncidentSortDirection] = useState<SortDirection>('desc')
  const [needsSortDirection, setNeedsSortDirection] = useState<SortDirection>('desc')
  const [regionSortDirection, setRegionSortDirection] = useState<SortDirection>('desc')
  const [chartWidgetOrder, setChartWidgetOrder] = useState<ChartWidgetId[]>([
    'incident-types',
    'primary-needs',
    'regional-pressure',
  ])
  const [overviewSectionOrder, setOverviewSectionOrder] = useState<OverviewSectionId[]>([
    'filters',
    'map',
    'severity',
    'charts',
  ])
  const [incidentChartHover, setIncidentChartHover] = useState<ChartHoverDatum | null>(null)
  const [needsChartHover, setNeedsChartHover] = useState<ChartHoverDatum | null>(null)
  const [regionChartHover, setRegionChartHover] = useState<ChartHoverDatum | null>(null)

  // Filter states
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [formTypeFilter, setFormTypeFilter] = useState<'all' | 'incident' | 'beneficiary'>('all')
  const [regionFilter, setRegionFilter] = useState('')
  const [incidentTypeFilter, setIncidentTypeFilter] = useState('')
  const [primaryNeedFilter, setPrimaryNeedFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | ''>('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 25

  // Widget order — charts combined as 'charts-row' for side-by-side layout
  const hasHqDashboardAccess = isHqDashboardRole(userRole)
  const canUseFullDashboard = hasHqDashboardAccess && !isMobileViewport

  const chartSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleChartDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setChartWidgetOrder((items) => {
      const oldIndex = items.indexOf(active.id as ChartWidgetId)
      const newIndex = items.indexOf(over.id as ChartWidgetId)
      return oldIndex === -1 || newIndex === -1
        ? items
        : arrayMove(items, oldIndex, newIndex)
    })
  }

  const handleOverviewDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setOverviewSectionOrder((items) => {
      const oldIndex = items.indexOf(active.id as OverviewSectionId)
      const newIndex = items.indexOf(over.id as OverviewSectionId)
      return oldIndex === -1 || newIndex === -1
        ? items
        : arrayMove(items, oldIndex, newIndex)
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setKey(null)
    setOrgPublicKey(null)
    setUserRole(null)
    setEncryptedRecords([])
    setDecryptedRecords([])
    navigate({ to: '/login' })
  }

  useEffect(() => {
    const id = setInterval(() => setTimeAgoTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!orgId || !hasHqDashboardAccess) {
      setEncryptedRecords([])
      return
    }
    const fetchRecords = async () => {
      setLoading(true)
      setFetchError(null)
      try {
        const { data, error: supabaseError } = canUseFullDashboard
          ? await supabase
              .from('encrypted_records')
              .select('*')
              .eq('org_id', orgId)
          : await supabase
              .from('encrypted_records')
              .select('id,record_id,form_type,created_at')
              .eq('org_id', orgId)
        if (supabaseError) throw supabaseError
        setEncryptedRecords((data || []) as EncryptedRecordRow[])
        setLastFetchedAt(new Date())
      } catch (err: unknown) {
        setFetchError(err instanceof Error ? err.message : 'Failed to fetch records')
        setEncryptedRecords([])
      } finally {
        setLoading(false)
      }
    }
    fetchRecords()
  }, [orgId, hasHqDashboardAccess, canUseFullDashboard, retryCount])

  useEffect(() => {
    if (!isMobileViewport) return
    setKey(null)
    setChatOpen(false)
    setDecryptedRecords([])
    setFailedDecryptions([])
  }, [isMobileViewport])

  useEffect(() => {
    if (!key || !canUseFullDashboard || encryptedRecords.length === 0) {
      setDecryptedRecords([])
      setFailedDecryptions([])
      return
    }
    const decryptAll = async () => {
      setLoading(true)
      setError(null)
      try {
        const decrypted = []
        const failed: { id: string; record_id: string }[] = []
        for (const enc of encryptedRecords) {
          try {
            if (!enc.encrypted_data) {
              throw new Error('Missing encrypted data')
            }
            const envelope =
              typeof enc.encrypted_data === 'string'
                ? JSON.parse(enc.encrypted_data)
                : enc.encrypted_data
            const plaintext = decryptRecord(envelope, key.secretKey)
            decrypted.push({
              id: enc.id,
              record_id: enc.record_id,
              form_type: enc.form_type,
              ...plaintext,
              created_at: enc.created_at,
            })
          } catch (err) {
            console.error('Failed to decrypt record', enc.record_id, err)
            failed.push({ id: enc.id, record_id: enc.record_id })
          }
        }
        setDecryptedRecords(decrypted)
        setFailedDecryptions(failed)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Decryption failed')
      } finally {
        setLoading(false)
      }
    }
    decryptAll()
  }, [key, encryptedRecords, canUseFullDashboard])

  const handleSubmitPassphrase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passphrase.trim()) {
      setError('Please enter the organization passphrase')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (!orgPublicKey) {
        setError('Organization key is unavailable. Please log in again.')
        setKey(null)
        return
      }

      const derived = deriveKeyFromPassphrase(passphrase)
      if (encodeBase64(derived.publicKey) !== orgPublicKey) {
        setError('That passphrase does not match this organization. Check it and try again.')
        setKey(null)
        setDecryptedRecords([])
        setFailedDecryptions([])
        return
      }

      setKey(derived)
      setPassphrase('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to derive key')
      setKey(null)
    } finally {
      setLoading(false)
    }
  }

  const filteredRecords = decryptedRecords.filter((r) => {
    const recordDate = new Date(getRecordDateInput(r))
    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      if (recordDate < start) return false
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      if (recordDate > end) return false
    }
    if (formTypeFilter !== 'all' && r.form_type !== formTypeFilter) return false
    if (regionFilter && r.region !== regionFilter) return false
    if (incidentTypeFilter) {
      if (r.form_type !== 'incident' || r.incidentType !== incidentTypeFilter) {
        return false
      }
    }
    if (severityFilter) {
      if (r.form_type !== 'incident' || r.severityLevel !== severityFilter) {
        return false
      }
    }
    if (primaryNeedFilter) {
      const needs = getStringArray(r, 'primaryNeeds')
      if (r.form_type !== 'beneficiary' || !needs.includes(primaryNeedFilter)) {
        return false
      }
    }
    return true
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [
    startDate,
    endDate,
    formTypeFilter,
    regionFilter,
    incidentTypeFilter,
    severityFilter,
    primaryNeedFilter,
  ])

  const totalPages = Math.ceil(filteredRecords.length / pageSize)
  const currentPageRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const incidentRecords = filteredRecords.filter((r) => r.form_type === 'incident')
  const beneficiaryRecords = filteredRecords.filter((r) => r.form_type === 'beneficiary')

  const availableRegions = Array.from(
    new Set(
      decryptedRecords
        .map((r) => (typeof r.region === 'string' ? r.region : null))
        .filter((region): region is string => region !== null),
    )
  ).sort() as string[]

  const incidentTypeCounts: Record<string, number> = {}
  incidentRecords.forEach((r) => {
    const type = r.incidentType || 'other'
    const key = String(type)
    incidentTypeCounts[key] = (incidentTypeCounts[key] || 0) + 1
  })
  const chartData = Object.entries(incidentTypeCounts).map(([type, count]) => ({
    incidentType: type,
    count,
  }))
  const sortedIncidentChartData = sortData(chartData, incidentSortDirection)

  const primaryNeedsCounts: Record<string, number> = {}
  beneficiaryRecords.forEach((r) => {
    const needs = r.primaryNeeds
    if (Array.isArray(needs)) {
      needs.forEach((need) => {
        const key = String(need)
        primaryNeedsCounts[key] = (primaryNeedsCounts[key] || 0) + 1
      })
    }
  })
  const beneficiaryChartData = Object.entries(primaryNeedsCounts).map(([need, count]) => ({
    need,
    count,
  }))
  const sortedBeneficiaryChartData = sortData(
    beneficiaryChartData,
    needsSortDirection,
  )

  const severityCounts: Record<SeverityLevel, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  }
  incidentRecords.forEach((record) => {
    const severity = getStringValue(record, 'severityLevel')
    if (severity && isSeverityLevel(severity)) {
      severityCounts[severity] += 1
    }
  })
  const severityChartData: Array<{ severity: SeverityLevel; count: number }> =
    (Object.entries(severityCounts) as Array<[SeverityLevel, number]>)
    .filter(([, count]) => count > 0)
    .map(([severity, count]) => ({ severity, count }))

  const regionCounts: Record<string, number> = {}
  filteredRecords.forEach((record) => {
    const region = getStringValue(record, 'region')
    if (region) regionCounts[region] = (regionCounts[region] ?? 0) + 1
  })
  const regionChartData = sortData(
    Object.entries(regionCounts).map(([region, count]) => ({ region, count })),
    regionSortDirection,
  ).slice(0, 8)

  const highSeverityCount = incidentRecords.filter((record) => {
    const severity = getStringValue(record, 'severityLevel')
    return severity === 'high' || severity === 'critical'
  }).length

  const protectionConcernCount = beneficiaryRecords.filter((record) => {
    const protectionConcerns = record.protectionConcerns
    return protectionConcerns === true || protectionConcerns === 'yes'
  }).length

  const affectedPeopleCount = incidentRecords.reduce(
    (sum, record) => sum + getNumberValue(record, 'numberOfAffected'),
    0,
  )

  const latestFilteredDate = filteredRecords.reduce<Date | null>((latest, record) => {
    const next = new Date(getRecordDateInput(record))
    if (Number.isNaN(next.getTime())) return latest
    return !latest || next > latest ? next : latest
  }, null)

  const topNeed =
    beneficiaryChartData.length > 0
      ? [...beneficiaryChartData].sort((a, b) => b.count - a.count)[0]
      : null

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setFormTypeFilter('all')
    setRegionFilter('')
    setIncidentTypeFilter('')
    setPrimaryNeedFilter('')
    setSeverityFilter('')
  }

  const activeFilterChips: ActiveFilterChip[] = [
    startDate
      ? {
          id: 'startDate',
          label: `From ${formatDateInputLabel(startDate)}`,
          onClear: () => setStartDate(''),
        }
      : null,
    endDate
      ? {
          id: 'endDate',
          label: `To ${formatDateInputLabel(endDate)}`,
          onClear: () => setEndDate(''),
        }
      : null,
    formTypeFilter !== 'all'
      ? {
          id: 'formType',
          label: titleize(formTypeFilter),
          onClear: () => setFormTypeFilter('all'),
        }
      : null,
    regionFilter
      ? {
          id: 'region',
          label: regionFilter,
          onClear: () => setRegionFilter(''),
        }
      : null,
    incidentTypeFilter
      ? {
          id: 'incidentType',
          label: titleize(incidentTypeFilter),
          onClear: () => setIncidentTypeFilter(''),
        }
      : null,
    severityFilter
      ? {
          id: 'severity',
          label: `Severity: ${titleize(severityFilter)}`,
          onClear: () => setSeverityFilter(''),
        }
      : null,
    primaryNeedFilter
      ? {
          id: 'primaryNeed',
          label: titleize(primaryNeedFilter),
          onClear: () => setPrimaryNeedFilter(''),
        }
      : null,
  ].filter((chip): chip is ActiveFilterChip => chip !== null)

  const renderOperationalFiltersSection = () => (
    <section className="mb-6 rounded-lg border border-[var(--dash-warm-border)] bg-card p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 pr-10">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">
            Operational filters
          </p>
        </div>
        <button
          type="button"
          onClick={clearFilters}
          disabled={activeFilterChips.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--dash-warm-border)] px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Reset filters
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="space-y-2">
          <label htmlFor="startDate" className="block text-xs font-medium text-card-foreground">
            Start Date
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="endDate" className="block text-xs font-medium text-card-foreground">
            End Date
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="formType" className="block text-xs font-medium text-card-foreground">
            Form Type
          </label>
          <select
            id="formType"
            value={formTypeFilter}
            onChange={(e) =>
              setFormTypeFilter(e.target.value as typeof formTypeFilter)
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All</option>
            <option value="incident">Incidents</option>
            <option value="beneficiary">Beneficiaries</option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="region" className="block text-xs font-medium text-card-foreground">
            Region
          </label>
          <select
            id="region"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Regions</option>
            {availableRegions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="incidentType" className="block text-xs font-medium text-card-foreground">
            Incident Type
          </label>
          <select
            id="incidentType"
            value={incidentTypeFilter}
            onChange={(e) => setIncidentTypeFilter(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Types</option>
            {Object.keys(incidentTypeCounts).sort().map((type) => (
              <option key={type} value={type}>
                {titleize(type)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="primaryNeed" className="block text-xs font-medium text-card-foreground">
            Primary Need
          </label>
          <select
            id="primaryNeed"
            value={primaryNeedFilter}
            onChange={(e) => setPrimaryNeedFilter(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Needs</option>
            {Object.keys(primaryNeedsCounts).sort().map((need) => (
              <option key={need} value={need}>
                {titleize(need)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {activeFilterChips.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {activeFilterChips.map((chip) => (
            <ActiveFilterPill key={chip.id} chip={chip} />
          ))}
        </div>
      ) : null}
    </section>
  )

  const renderMapSection = () => (
    <section className="mb-6">
      <MapView
        records={filteredRecords}
        selectedRegion={regionFilter || null}
        onRegionSelect={(region) => {
          setRegionFilter(region ?? '')
          setActiveView('overview')
        }}
      />
    </section>
  )

  const renderChartsSection = () => (
    <DndContext
      sensors={chartSensors}
      collisionDetection={closestCenter}
      onDragEnd={handleChartDragEnd}
    >
      <SortableContext
        items={chartWidgetOrder}
        strategy={rectSortingStrategy}
      >
        <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          {chartWidgetOrder.map((widgetId) => {
            if (widgetId === 'incident-types') {
              return (
                <SortableChartCard key={widgetId} id={widgetId}>
                  <div className="mb-4 flex items-center justify-between gap-3 pr-8">
                    <h3 className="text-base font-semibold text-foreground">
                      Incidents by Type
                    </h3>
                    <div className="flex flex-wrap justify-end gap-1">
                      {(['bar', 'line', 'pie'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setChartType(type)}
                          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                            chartType === type
                              ? 'border-transparent bg-primary text-primary-foreground'
                              : 'border-[var(--dash-warm-border)] bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {titleize(type)}
                        </button>
                      ))}
                      <ChartToolbar
                        sortDirection={incidentSortDirection}
                        onToggleSort={() =>
                          setIncidentSortDirection((direction) =>
                            direction === 'desc' ? 'asc' : 'desc',
                          )
                        }
                        onReset={() => setIncidentTypeFilter('')}
                        resetDisabled={!incidentTypeFilter}
                      />
                    </div>
                  </div>
                  {sortedIncidentChartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No incident data.</p>
                  ) : (
                    <>
                      <ChartHoverReadout datum={incidentChartHover} />
                      <ResponsiveContainer width="100%" height={320}>
                        {chartType === 'bar' ? (
                          <BarChart
                            data={sortedIncidentChartData}
                            margin={{ top: 18, right: 10, bottom: 58, left: 0 }}
                            onMouseMove={(state: RechartsHoverState) =>
                              setIncidentChartHover(getChartHoverDatum(state))
                            }
                            onMouseLeave={() => setIncidentChartHover(null)}
                          >
                          <XAxis
                            dataKey="incidentType"
                            interval={0}
                            angle={sortedIncidentChartData.length > 4 ? -28 : 0}
                            textAnchor={sortedIncidentChartData.length > 4 ? 'end' : 'middle'}
                            height={sortedIncidentChartData.length > 4 ? 72 : 32}
                            tick={{ fontSize: 10.5, fill: 'var(--color-muted-foreground)' }}
                            tickFormatter={titleize}
                            tickMargin={8}
                          />
                          <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
                          <CompactChartTooltip />
                          <Bar
                            dataKey="count"
                            radius={[4, 4, 0, 0]}
                            activeBar={{
                              fillOpacity: 0.82,
                              stroke: 'var(--color-foreground)',
                              strokeWidth: 1,
                            }}
                          >
                            <LabelList
                              dataKey="count"
                              position="top"
                              formatter={(value: number) => value.toLocaleString()}
                              style={{
                                fill: 'var(--color-muted-foreground)',
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            />
                            {sortedIncidentChartData.map((entry, index) => (
                              <Cell
                                key={entry.incidentType}
                                fill={
                                  incidentTypeFilter === entry.incidentType
                                    ? 'var(--color-foreground)'
                                    : CHART_COLORS[index % CHART_COLORS.length]
                                }
                                onMouseEnter={() =>
                                  setIncidentChartHover({
                                    label: titleize(entry.incidentType),
                                    value: entry.count.toLocaleString(),
                                  })
                                }
                                onMouseLeave={() => setIncidentChartHover(null)}
                                onClick={() => setIncidentTypeFilter(entry.incidentType)}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                        ) : chartType === 'line' ? (
                          <LineChart
                            data={sortedIncidentChartData}
                            margin={{ top: 18, right: 14, bottom: 58, left: 0 }}
                            onMouseMove={(state: RechartsHoverState) =>
                              setIncidentChartHover(getChartHoverDatum(state))
                            }
                            onMouseLeave={() => setIncidentChartHover(null)}
                          >
                          <XAxis
                            dataKey="incidentType"
                            interval={0}
                            angle={sortedIncidentChartData.length > 4 ? -28 : 0}
                            textAnchor={sortedIncidentChartData.length > 4 ? 'end' : 'middle'}
                            height={sortedIncidentChartData.length > 4 ? 72 : 32}
                            tick={{ fontSize: 10.5, fill: 'var(--color-muted-foreground)' }}
                            tickFormatter={titleize}
                            tickMargin={8}
                          />
                          <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
                          <CompactChartTooltip />
                          <Line
                            type="monotone"
                            dataKey="count"
                            stroke="var(--color-primary)"
                            strokeWidth={2}
                            activeDot={{ r: 5, strokeWidth: 2 }}
                          >
                            <LabelList
                              dataKey="count"
                              position="top"
                              formatter={(value: number) => value.toLocaleString()}
                              style={{
                                fill: 'var(--color-muted-foreground)',
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            />
                          </Line>
                        </LineChart>
                        ) : (
                          <PieChart
                            onMouseMove={(state: RechartsHoverState) =>
                              setIncidentChartHover(getChartHoverDatum(state))
                            }
                            onMouseLeave={() => setIncidentChartHover(null)}
                          >
                          <CompactChartTooltip />
                          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-muted-foreground)' }} />
                          <Pie
                            data={sortedIncidentChartData}
                            dataKey="count"
                            nameKey="incidentType"
                            cx="50%"
                            cy="50%"
                            outerRadius={92}
                            label={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                          >
                            {sortedIncidentChartData.map((entry, index) => (
                              <Cell
                                key={entry.incidentType}
                                fill={
                                  incidentTypeFilter === entry.incidentType
                                    ? 'var(--color-foreground)'
                                    : CHART_COLORS[index % CHART_COLORS.length]
                                }
                                onMouseEnter={() =>
                                  setIncidentChartHover({
                                    label: titleize(entry.incidentType),
                                    value: entry.count.toLocaleString(),
                                  })
                                }
                                onMouseLeave={() => setIncidentChartHover(null)}
                                onClick={() => setIncidentTypeFilter(entry.incidentType)}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      )}
                      </ResponsiveContainer>
                    </>
                  )}
                </SortableChartCard>
              )
            }

            if (widgetId === 'primary-needs') {
              return (
                <SortableChartCard key={widgetId} id={widgetId}>
                  <div className="mb-4 flex items-center justify-between gap-3 pr-8">
                    <h3 className="text-base font-semibold text-foreground">
                      Beneficiary Primary Needs
                    </h3>
                    <ChartToolbar
                      sortDirection={needsSortDirection}
                      onToggleSort={() =>
                        setNeedsSortDirection((direction) =>
                          direction === 'desc' ? 'asc' : 'desc',
                        )
                      }
                      onReset={() => setPrimaryNeedFilter('')}
                      resetDisabled={!primaryNeedFilter}
                    />
                  </div>
                  {sortedBeneficiaryChartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No beneficiary data.</p>
                  ) : (
                    <>
                      <ChartHoverReadout datum={needsChartHover} />
                      <ResponsiveContainer width="100%" height={290}>
                        <PieChart
                          onMouseMove={(state: RechartsHoverState) =>
                            setNeedsChartHover(getChartHoverDatum(state))
                          }
                          onMouseLeave={() => setNeedsChartHover(null)}
                        >
                        <CompactChartTooltip />
                        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-muted-foreground)' }} />
                        <Pie
                          data={sortedBeneficiaryChartData}
                          dataKey="count"
                          nameKey="need"
                          cx="50%"
                          cy="50%"
                          outerRadius={92}
                          label={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                        >
                          {sortedBeneficiaryChartData.map((entry, index) => (
                            <Cell
                              key={entry.need}
                              fill={
                                primaryNeedFilter === entry.need
                                  ? 'var(--color-foreground)'
                                  : CHART_COLORS[index % CHART_COLORS.length]
                              }
                              onMouseEnter={() =>
                                setNeedsChartHover({
                                  label: titleize(entry.need),
                                  value: entry.count.toLocaleString(),
                                })
                              }
                              onMouseLeave={() => setNeedsChartHover(null)}
                              onClick={() => setPrimaryNeedFilter(entry.need)}
                            />
                          ))}
                        </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </SortableChartCard>
              )
            }

            return (
              <SortableChartCard key={widgetId} id={widgetId}>
                <div className="mb-4 flex items-center justify-between gap-3 pr-8">
                  <h3 className="text-base font-semibold text-foreground">
                    Regional Pressure
                  </h3>
                  <ChartToolbar
                    sortDirection={regionSortDirection}
                    onToggleSort={() =>
                      setRegionSortDirection((direction) =>
                        direction === 'desc' ? 'asc' : 'desc',
                      )
                    }
                    onReset={() => setRegionFilter('')}
                    resetDisabled={!regionFilter}
                  />
                </div>
                {regionChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No regional data.</p>
                ) : (
                  <>
                    <ChartHoverReadout datum={regionChartHover} />
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={regionChartData}
                        layout="vertical"
                        margin={{ top: 8, right: 36, bottom: 8, left: 24 }}
                        onMouseMove={(state: RechartsHoverState) =>
                          setRegionChartHover(getChartHoverDatum(state))
                        }
                        onMouseLeave={() => setRegionChartHover(null)}
                      >
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
                      <YAxis
                        type="category"
                        dataKey="region"
                        interval={0}
                        tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                        width={104}
                      />
                      <CompactChartTooltip />
                      <Bar
                        dataKey="count"
                        radius={[0, 4, 4, 0]}
                        activeBar={{
                          fillOpacity: 0.82,
                          stroke: 'var(--color-foreground)',
                          strokeWidth: 1,
                        }}
                      >
                        <LabelList
                          dataKey="count"
                          position="right"
                          formatter={(value: number) => value.toLocaleString()}
                          style={{
                            fill: 'var(--color-muted-foreground)',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        />
                        {regionChartData.map((entry, index) => (
                          <Cell
                            key={entry.region}
                            fill={
                              regionFilter === entry.region
                                ? 'var(--color-foreground)'
                                : CHART_COLORS[index % CHART_COLORS.length]
                            }
                            onMouseEnter={() =>
                              setRegionChartHover({
                                label: entry.region,
                                value: entry.count.toLocaleString(),
                              })
                            }
                            onMouseLeave={() => setRegionChartHover(null)}
                            onClick={() => setRegionFilter(entry.region)}
                          />
                        ))}
                      </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}
              </SortableChartCard>
            )
          })}
        </section>
      </SortableContext>
    </DndContext>
  )

  const renderSeveritySection = () => (
    <section className="mb-6 rounded-lg border border-[var(--dash-warm-border)] bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3 pr-10">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Severity Mix
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Click a severity to filter incidents.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSeverityFilter('')}
          disabled={!severityFilter}
          className="rounded-md border border-[var(--dash-warm-border)] px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
        >
          Reset
        </button>
      </div>
      {severityChartData.length === 0 ? (
        <p className="text-sm text-muted-foreground">No severity data.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {severityChartData.map((item) => (
            <button
              type="button"
              key={item.severity}
              onClick={() =>
                setSeverityFilter((current) =>
                  current === item.severity ? '' : item.severity,
                )
              }
              className={`rounded-md border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                severityFilter === item.severity
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-[var(--dash-warm-border)] bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize text-foreground">
                  {item.severity}
                </span>
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: SEVERITY_COLORS[item.severity] }}
                />
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {item.count}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  )

  const renderOverviewSection = (sectionId: OverviewSectionId) => {
    const content =
      sectionId === 'filters'
        ? renderOperationalFiltersSection()
        : sectionId === 'map'
          ? renderMapSection()
          : sectionId === 'charts'
            ? renderChartsSection()
            : renderSeveritySection()

    return (
      <SortableOverviewSection
        key={sectionId}
        id={sectionId}
        disabled={isMobileViewport}
      >
        {content}
      </SortableOverviewSection>
    )
  }

  // suppress lint for tick-only state
  void timeAgoTick

  const resolvedThemeMode =
    themeMode === 'auto' ? (prefersDarkTheme ? 'dark' : 'light') : themeMode
  const dashboardTheme =
    resolvedThemeMode === 'dark' ? PASTEL_DARK_THEME : PASTEL_LIGHT_THEME

  const metadataIncidentCount = encryptedRecords.filter(
    (record) => record.form_type === 'incident',
  ).length
  const metadataBeneficiaryCount = encryptedRecords.filter(
    (record) => record.form_type === 'beneficiary',
  ).length
  const latestMetadataDate = encryptedRecords.reduce<Date | null>(
    (latest, record) => {
      const next = new Date(record.created_at)
      if (Number.isNaN(next.getTime())) return latest
      return !latest || next > latest ? next : latest
    },
    null,
  )

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-muted-foreground">Verifying session…</div>
      </div>
    )
  }

  if (!hasHqDashboardAccess) {
    return (
      <div className="min-h-screen bg-muted" style={dashboardTheme}>
        <header className="bg-card border-b border-[var(--dash-warm-border)]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-foreground">
                  GetRefuge Dashboard
                </h1>
              </div>
              <div className="flex items-center">
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 bg-destructive/10 text-destructive text-xs font-medium rounded-full hover:bg-destructive/20"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="bg-card rounded-lg shadow-sm border border-[var(--dash-warm-border)] p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Secure mobile workflow required
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Full decrypted dashboards are reserved for authorized managers and
              analysts. Field workers should use the secure GetRefuge mobile app
              for collection, local AI checks, and encrypted sync.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Signed-in account type:{' '}
              <span className="font-medium text-foreground">
                {formatDashboardRole(userRole)}
              </span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              For the HQ dashboard, use an account with the Manager,
              Analyst, or Admin role.
            </p>
          </div>
        </main>
      </div>
    )
  }

  if (isMobileViewport) {
    return (
      <div className="min-h-screen bg-muted" style={dashboardTheme}>
        <header className="bg-card border-b border-[var(--dash-warm-border)]">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-foreground">
                  GetRefuge Dashboard
                </h1>
              </div>
              <div className="flex items-center">
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 bg-destructive/10 text-destructive text-xs font-medium rounded-full hover:bg-destructive/20"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-card rounded-lg shadow-sm border border-[var(--dash-warm-border)] p-5">
            <h2 className="text-lg font-semibold text-foreground">
              Mobile safe summary
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Authorized managers and analysts can confirm sync status here, but
              mobile web does not decrypt records or show maps, exports, tables,
              or AI chat. Use a trusted desktop environment for the full
              dashboard.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3">
              <div className="rounded-md border border-[var(--dash-warm-border)] bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Synced incident reports
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {metadataIncidentCount}
                </p>
              </div>
              <div className="rounded-md border border-[var(--dash-warm-border)] bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Synced beneficiary interviews
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {metadataBeneficiaryCount}
                </p>
              </div>
              <div className="rounded-md border border-[var(--dash-warm-border)] bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Latest synced metadata
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {latestMetadataDate
                    ? latestMetadataDate.toLocaleString()
                    : loading
                      ? 'Loading...'
                      : 'No synced records yet'}
                </p>
              </div>
            </div>
            {fetchError ? (
              <p className="mt-4 text-sm text-destructive">
                {fetchError.length > 200 ? fetchError.slice(0, 200) + '...' : fetchError}
              </p>
            ) : null}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-muted"
      style={dashboardTheme}
    >
      {/* Header */}
      <header className="bg-card border-b border-[var(--dash-warm-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-foreground">
                GetRefuge Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeModeControl mode={themeMode} onChange={setThemeMode} />
              {lastFetchedAt && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {formatTimeAgo(lastFetchedAt)}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-destructive/10 text-destructive text-xs font-medium rounded-full hover:bg-destructive/20"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Passphrase input */}
          {!key && (
            <div className="bg-card rounded-lg shadow-sm border border-[var(--dash-warm-border)] p-6 mb-6">
              <h2 className="text-lg font-medium text-foreground mb-4">
                Organization Passphrase Required
              </h2>
              <p className="text-muted-foreground mb-4">
                Authorized managers and analysts must enter the organization
                passphrase before decrypted records are available.
              </p>
              <form onSubmit={handleSubmitPassphrase} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="passphrase" className="block text-sm font-medium text-card-foreground">
                    Passphrase
                  </label>
                  <input
                    id="passphrase"
                    type="password"
                    required
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                    autoComplete="current-password"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 font-medium"
                >
                  {loading ? 'Deriving key…' : 'Submit'}
                </button>
              </form>
            </div>
          )}

          {key && canUseFullDashboard && (
            <>
              <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Authorized HQ workspace
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-foreground">
                    HQ Command Center
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    Aggregate view first. Full decrypted records stay in Record Review
                    for deliberate analyst access.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DashboardTabButton
                    active={activeView === 'overview'}
                    icon={BarChart3}
                    label="Overview"
                    onClick={() => setActiveView('overview')}
                  />
                  <DashboardTabButton
                    active={activeView === 'reports'}
                    icon={ClipboardList}
                    label="Reports"
                    onClick={() => setActiveView('reports')}
                  />
                  <DashboardTabButton
                    active={activeView === 'forms'}
                    icon={FileText}
                    label="Form Studio"
                    onClick={() => setActiveView('forms')}
                  />
                  <DashboardTabButton
                    active={activeView === 'records'}
                    icon={Table2}
                    label="Record Review"
                    onClick={() => setActiveView('records')}
                  />
                </div>
              </section>

              <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <KpiCard
                  label="Records in view"
                  value={filteredRecords.length}
                  detail={`${encryptedRecords.length} encrypted records synced`}
                  icon={ShieldCheck}
                  accent="#0f766e"
                />
                <KpiCard
                  label="High severity"
                  value={highSeverityCount}
                  detail="High or critical incident reports"
                  icon={AlertTriangle}
                  accent="#dc2626"
                />
                <KpiCard
                  label="People affected"
                  value={affectedPeopleCount}
                  detail="Reported on visible incident records"
                  icon={MapPinned}
                  accent="#2563eb"
                />
                <KpiCard
                  label="Protection flags"
                  value={protectionConcernCount}
                  detail="Beneficiary interviews with concerns"
                  icon={AlertCircle}
                  accent="#ca8a04"
                />
                <KpiCard
                  label="Latest update"
                  value={latestFilteredDate ? formatTimeAgo(latestFilteredDate).replace('Updated ', '') : '-'}
                  detail={topNeed ? `Top need: ${titleize(topNeed.need)}` : 'No visible needs yet'}
                  icon={RefreshCw}
                  accent="#7c3aed"
                />
              </section>

              {(activeView === 'reports' || activeView === 'records') &&
                renderOperationalFiltersSection()}

              {activeView === 'overview' && (
                <DndContext
                  sensors={chartSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleOverviewDragEnd}
                >
                  <SortableContext
                    items={overviewSectionOrder}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-0">
                      {overviewSectionOrder.map(renderOverviewSection)}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {activeView === 'reports' && (
                <CustomReportsPanel
                  records={filteredRecords}
                  activeFilterLabels={activeFilterChips.map((chip) => chip.label)}
                  onOpenAnalyst={() => setChatOpen(true)}
                />
              )}

              {activeView === 'forms' && <FormStudioPanel />}

              {activeView === 'records' && (
                <section className="rounded-lg border border-[var(--dash-warm-border)] bg-card p-5 shadow-sm">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        Deliberate decrypted access
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-foreground">
                        Record Review{' '}
                        <span className="text-sm font-normal text-muted-foreground">
                          ({decryptedRecords.length} of {encryptedRecords.length} decrypted)
                        </span>
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          Export filtered ({filteredRecords.length})
                        </p>
                        <div className="flex gap-2">
                          <ExportPdf records={filteredRecords} label="PDF" />
                          <ExportExcel records={filteredRecords} label="Excel" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          Export page ({currentPageRecords.length})
                        </p>
                        <div className="flex gap-2">
                          <ExportPdf records={currentPageRecords} label="PDF" />
                          <ExportExcel records={currentPageRecords} label="Excel" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {fetchError ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
                      <h3 className="text-base font-medium text-foreground">Could not load records</h3>
                      <p className="mt-1 max-w-md text-sm text-destructive">
                        {fetchError.length > 200 ? fetchError.slice(0, 200) + '...' : fetchError}
                      </p>
                      <button
                        type="button"
                        onClick={() => setRetryCount((c) => c + 1)}
                        className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        Retry
                      </button>
                    </div>
                  ) : loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Loading records...</p>
                    </div>
                  ) : filteredRecords.length === 0 && failedDecryptions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Inbox className="mb-3 h-10 w-10 text-muted-foreground" />
                      <h3 className="text-base font-medium text-foreground">
                        {decryptedRecords.length === 0 ? 'No records yet' : 'No records match filters'}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {decryptedRecords.length === 0
                          ? 'Records will appear here when synced from the field'
                          : 'Adjust filters or reset the active view'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <Table>
                        <thead>
                          <tr className="bg-muted">
                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                              Date
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                              Region
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                              Form Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                              Severity
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--dash-warm-border)] bg-card">
                          {currentPageRecords.map((record) => (
                            <tr key={record.id} className="hover:bg-muted/50">
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                                {new Date(getRecordDateInput(record)).toLocaleDateString()}
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                                {typeof record.region === 'string' ? record.region : '-'}
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm capitalize text-foreground">
                                {record.form_type}
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                                {typeof record.severityLevel === 'string' ? record.severityLevel : '-'}
                              </td>
                            </tr>
                          ))}
                          {failedDecryptions.map((f) => (
                            <tr key={f.id} className="bg-destructive/5">
                              <td colSpan={4} className="px-6 py-4 text-sm text-destructive line-through">
                                Record {f.record_id} could not be decrypted
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalRecords={filteredRecords.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                      />
                    </>
                  )}
                </section>
              )}
            </>
          )}

        </div>
      </main>

      {key && canUseFullDashboard && !chatOpen && (
        <DraggableAnalystLauncher onOpen={() => setChatOpen(true)} />
      )}

      {key && canUseFullDashboard && (
        <ChatPanel
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          records={filteredRecords.map((r) => ({
            record_id: r.record_id,
            form_type: r.form_type,
            created_at: r.created_at,
            data: (() => {
              const { record_id, form_type, created_at, id, ...data } = r
              return data
            })(),
          })) as QueryExecutorDecryptedRecord[]}
        />
      )}
    </div>
  )
}
