import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useState } from 'react'
import {
  AttributionControl,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L, { type LeafletMouseEvent } from 'leaflet'
import 'leaflet.heat'
import { cn } from '@/lib/utils'
import {
  REGION_CENTROIDS,
  SYRIA_CENTER,
  type RegionName,
} from '@/lib/regionCentroids'
import type { DecryptedRecord, MapViewProps } from './MapView'

type SeverityLevel = 'low' | 'medium' | 'high' | 'critical'

type RegionAggregate = {
  region: string
  count: number
  incidentCount: number
  beneficiaryCount: number
  dominantSeverity: SeverityLevel | null
  severityBreakdown: Partial<Record<SeverityLevel, number>>
  topTypes: Array<{ type: string; count: number }>
  otherTypeCount: number
  topNeeds: Array<{ need: string; count: number }>
  needSelectionCount: number
  otherNeedCount: number
}

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  low: '#4F8FE8',
  medium: '#D69C38',
  high: '#F27A57',
  critical: '#C74343',
}

const BENEFICIARY_COLOR = '#76B08A'

const SEVERITY_WEIGHTS: Record<SeverityLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

function isSeverityLevel(value: string): value is SeverityLevel {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical'
}

function titleize(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getStringArray(record: DecryptedRecord, field: string): string[] {
  const value = record[field]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function markerColor(aggregate: RegionAggregate): string {
  if (aggregate.dominantSeverity) {
    return SEVERITY_COLORS[aggregate.dominantSeverity]
  }
  return BENEFICIARY_COLOR
}

function aggregateByRegion(records: DecryptedRecord[]): RegionAggregate[] {
  const byRegion = new Map<string, DecryptedRecord[]>()

  for (const record of records) {
    const region = record.region as string | undefined
    if (!region || !(region in REGION_CENTROIDS)) continue
    const list = byRegion.get(region) ?? []
    list.push(record)
    byRegion.set(region, list)
  }

  const result: RegionAggregate[] = []

  for (const [region, list] of byRegion) {
    const severityBreakdown: Partial<Record<SeverityLevel, number>> = {}
    const typeCounts: Record<string, number> = {}
    const needCounts: Record<string, number> = {}
    let incidentCount = 0
    let beneficiaryCount = 0

    for (const record of list) {
      if (record.form_type === 'incident') {
        incidentCount += 1
        const severity = typeof record.severityLevel === 'string'
          ? record.severityLevel
          : 'low'
        if (isSeverityLevel(severity)) {
          severityBreakdown[severity] = (severityBreakdown[severity] ?? 0) + 1
        }

        const incidentType = typeof record.incidentType === 'string'
          ? record.incidentType
          : 'other'
        typeCounts[incidentType] = (typeCounts[incidentType] ?? 0) + 1
      } else {
        beneficiaryCount += 1
        for (const need of getStringArray(record, 'primaryNeeds')) {
          needCounts[need] = (needCounts[need] ?? 0) + 1
        }
      }
    }

    let dominantSeverity: RegionAggregate['dominantSeverity'] = null
    let maxSeverityCount = -1
    for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
      const count = severityBreakdown[severity] ?? 0
      if (count > maxSeverityCount) {
        maxSeverityCount = count
        dominantSeverity = count > 0 ? severity : dominantSeverity
      }
    }

    const typeEntries = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
    const topTypes = typeEntries
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }))
    const otherTypeCount = typeEntries
      .slice(3)
      .reduce((sum, [, count]) => sum + count, 0)

    const needEntries = Object.entries(needCounts)
      .sort((a, b) => b[1] - a[1])
    const topNeeds = needEntries
      .slice(0, 3)
      .map(([need, count]) => ({ need, count }))
    const needSelectionCount = needEntries.reduce((sum, [, count]) => sum + count, 0)
    const otherNeedCount = needEntries
      .slice(3)
      .reduce((sum, [, count]) => sum + count, 0)

    result.push({
      region,
      count: list.length,
      incidentCount,
      beneficiaryCount,
      dominantSeverity,
      severityBreakdown,
      topTypes,
      otherTypeCount,
      topNeeds,
      needSelectionCount,
      otherNeedCount,
    })
  }

  return result
}

function HeatmapLayer({ points }: { points: Array<[number, number, number]> }) {
  const map = useMap()

  useEffect(() => {
    const layer = L.heatLayer(points, {
      radius: 35,
      blur: 25,
      max: 1.0,
      minOpacity: 0.4,
      gradient: {
        0.2: '#6BA5B4',
        0.4: '#76B08A',
        0.6: '#F2A56F',
        0.8: '#D96C75',
      },
    })
    layer.addTo(map)
    return () => {
      map.removeLayer(layer)
    }
  }, [map, points])

  return null
}

function MapBackgroundReset({
  onReset,
}: {
  onReset?: () => void
}) {
  useMapEvents({
    click: () => onReset?.(),
  })
  return null
}

function ResetMapViewControl({
  onReset,
}: {
  onReset?: () => void
}) {
  const map = useMap()

  useEffect(() => {
    let button: HTMLButtonElement | null = null
    const control = new L.Control({ position: 'topright' })

    control.onAdd = () => {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control')
      button = L.DomUtil.create('button', '', container) as HTMLButtonElement
      button.type = 'button'
      button.title = 'Reset map view'
      button.ariaLabel = 'Reset map view'
      button.textContent = 'Reset'
      button.style.height = '30px'
      button.style.minWidth = '54px'
      button.style.border = '0'
      button.style.padding = '0 10px'
      button.style.background = 'var(--color-card)'
      button.style.color = 'var(--color-foreground)'
      button.style.fontSize = '12px'
      button.style.fontWeight = '600'
      button.style.cursor = 'pointer'

      L.DomEvent.disableClickPropagation(container)
      L.DomEvent.disableScrollPropagation(container)

      button.addEventListener('click', handleClick)
      return container
    }

    const handleClick = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      map.setView(SYRIA_CENTER, 7, { animate: true })
      onReset?.()
    }

    control.addTo(map)

    return () => {
      button?.removeEventListener('click', handleClick)
      control.remove()
    }
  }, [map, onReset])

  return null
}

export function MapViewClient({
  records,
  selectedRegion,
  onRegionSelect,
}: MapViewProps) {
  const [mode, setMode] = useState<'markers' | 'heatmap'>('markers')
  const aggregates = useMemo(() => aggregateByRegion(records), [records])

  const heatmapPoints = useMemo(() => {
    const points: Array<[number, number, number]> = []

    for (const record of records) {
      const region = record.region as string | undefined
      if (!region || !(region in REGION_CENTROIDS)) continue
      const centroid = REGION_CENTROIDS[region as RegionName]
      const severity = typeof record.severityLevel === 'string'
        && isSeverityLevel(record.severityLevel)
        ? record.severityLevel
        : null
      const weight = severity
        ? (SEVERITY_WEIGHTS[severity] ?? 1) / 4
        : 0.35
      const lat = centroid[0] + (Math.random() * 0.2 - 0.1)
      const lng = centroid[1] + (Math.random() * 0.2 - 0.1)
      points.push([lat, lng, weight])
    }

    return points
  }, [records])

  return (
    <div className="space-y-4 rounded-lg border border-[var(--dash-warm-border)] bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Field geography
          </p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">
            Regional Field Map
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Incidents and beneficiary interviews by region.
          </p>
        </div>
        <div className="inline-flex overflow-hidden rounded-full border border-[var(--dash-warm-border)]">
          <button
            type="button"
            onClick={() => setMode('markers')}
            className={cn(
              'px-3 py-1 text-xs font-medium transition-colors',
              mode === 'markers'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-card-foreground hover:bg-muted',
            )}
          >
            Markers
          </button>
          <button
            type="button"
            onClick={() => setMode('heatmap')}
            className={cn(
              'px-3 py-1 text-xs font-medium transition-colors',
              mode === 'heatmap'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-card-foreground hover:bg-muted',
            )}
          >
            Heatmap
          </button>
        </div>
      </div>
      <div className="h-[560px] w-full overflow-hidden rounded-md">
        <MapContainer
          center={SYRIA_CENTER}
          zoom={7}
          minZoom={3}
          maxZoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
          preferCanvas
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <AttributionControl prefix={false} />
          <MapBackgroundReset onReset={() => onRegionSelect?.(null)} />
          <ResetMapViewControl onReset={() => onRegionSelect?.(null)} />
          {mode === 'markers' &&
            aggregates.map((aggregate) => {
              const centroid = REGION_CENTROIDS[aggregate.region as RegionName]
              const radius = Math.max(8, Math.sqrt(aggregate.count) * 4)
              const color = markerColor(aggregate)
              const selected = selectedRegion === aggregate.region

              return (
                <CircleMarker
                  key={aggregate.region}
                  center={centroid}
                  radius={selected ? radius + 3 : radius}
                  pathOptions={{
                    color: selected ? 'var(--color-foreground)' : color,
                    fillColor: color,
                    fillOpacity: selected ? 0.78 : 0.58,
                    weight: selected ? 4 : 2,
                  }}
                  eventHandlers={{
                    click: (event: LeafletMouseEvent) => {
                      event.originalEvent.stopPropagation()
                      onRegionSelect?.(aggregate.region)
                    },
                  }}
                >
                  <Popup
                    autoPan
                    keepInView
                    autoPanPadding={[72, 72]}
                    maxWidth={320}
                  >
                    <div style={{ minWidth: 230, padding: '4px 2px', fontFamily: 'inherit' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: color,
                            flexShrink: 0,
                          }}
                        />
                        <strong style={{ fontSize: 13, fontWeight: 600 }}>{aggregate.region}</strong>
                      </div>
                      <p style={{ fontSize: 12, color: '#587074', marginBottom: 10 }}>
                        {aggregate.count} field record{aggregate.count === 1 ? '' : 's'}:
                        {' '}
                        {aggregate.incidentCount} incident{aggregate.incidentCount === 1 ? '' : 's'}
                        {' '}
                        and {aggregate.beneficiaryCount} beneficiary interview
                        {aggregate.beneficiaryCount === 1 ? '' : 's'}.
                      </p>

                      {aggregate.incidentCount > 0 ? (
                        <>
                          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#789094', marginBottom: 4 }}>Severity</p>
                          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 10 }}>
                            <tbody>
                              {Object.entries(aggregate.severityBreakdown).map(([severity, count]) => (
                                <tr key={severity}>
                                  <td style={{ paddingRight: 12, paddingBottom: 2, textTransform: 'capitalize', color: SEVERITY_COLORS[severity as SeverityLevel] ?? '#587074', fontWeight: 500 }}>{severity}</td>
                                  <td style={{ textAlign: 'right', paddingBottom: 2, color: '#102A2E' }}>{count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      ) : null}

                      {aggregate.topTypes.length > 0 ? (
                        <>
                          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#789094', marginBottom: 4 }}>Top 3 incident types</p>
                          <ul style={{ fontSize: 12, margin: 0, padding: 0, listStyle: 'none', marginBottom: 10 }}>
                            {aggregate.topTypes.map((type) => (
                              <li key={type.type} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 2 }}>
                                <span style={{ color: '#102A2E' }}>{titleize(type.type)}</span>
                                <span style={{ color: '#587074', marginLeft: 16 }}>{type.count}</span>
                              </li>
                            ))}
                            {aggregate.otherTypeCount > 0 ? (
                              <li style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 2 }}>
                                <span style={{ color: '#102A2E' }}>Other Types</span>
                                <span style={{ color: '#587074', marginLeft: 16 }}>{aggregate.otherTypeCount}</span>
                              </li>
                            ) : null}
                          </ul>
                        </>
                      ) : null}

                      {aggregate.topNeeds.length > 0 ? (
                        <>
                          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#789094', marginBottom: 4 }}>Top beneficiary needs ({aggregate.needSelectionCount} selections)</p>
                          <ul style={{ fontSize: 12, margin: 0, padding: 0, listStyle: 'none' }}>
                            {aggregate.topNeeds.map((need) => (
                              <li key={need.need} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 2 }}>
                                <span style={{ color: '#102A2E' }}>{titleize(need.need)}</span>
                                <span style={{ color: '#587074', marginLeft: 16 }}>{need.count}</span>
                              </li>
                            ))}
                            {aggregate.otherNeedCount > 0 ? (
                              <li style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 2 }}>
                                <span style={{ color: '#102A2E' }}>Other Needs</span>
                                <span style={{ color: '#587074', marginLeft: 16 }}>{aggregate.otherNeedCount}</span>
                              </li>
                            ) : null}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          {mode === 'heatmap' && <HeatmapLayer points={heatmapPoints} />}
        </MapContainer>
      </div>
    </div>
  )
}
