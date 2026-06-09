import { useEffect, useState, type ComponentType } from 'react'

export type DecryptedRecord = {
  id: string
  record_id: string
  form_type: 'incident' | 'beneficiary'
  created_at: string
  [key: string]: unknown
}

export type MapViewProps = {
  records: DecryptedRecord[]
  selectedRegion?: string | null
  onRegionSelect?: (region: string | null) => void
}

export function MapView(props: MapViewProps) {
  const [ClientMap, setClientMap] = useState<ComponentType<MapViewProps> | null>(null)

  useEffect(() => {
    let mounted = true
    import('./MapViewClient').then((module) => {
      if (mounted) setClientMap(() => module.MapViewClient)
    })
    return () => {
      mounted = false
    }
  }, [])

  if (!ClientMap) {
    return (
      <div className="h-[560px] w-full animate-pulse rounded-lg border border-border bg-muted" />
    )
  }

  return <ClientMap {...props} />
}
