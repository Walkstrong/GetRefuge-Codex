// Centroids of the 14 Syrian governorates used in sample regional views.
// Coordinates are governorate capital cities — public knowledge, not OPSEC-sensitive.
// Format: [latitude, longitude]

export type RegionName =
  | 'Idlib' | 'Aleppo' | 'Deir ez-Zor' | 'Al-Hasakah' | 'Rif Dimashq'
  | 'Homs' | 'Daraa' | 'Hama' | 'Ar-Raqqah' | 'Quneitra'
  | 'Latakia' | 'As-Suwayda' | 'Tartus' | 'Damascus'

export const REGION_CENTROIDS: Record<RegionName, [number, number]> = {
  'Idlib':       [35.9333, 36.6333],
  'Aleppo':      [36.2021, 37.1343],
  'Deir ez-Zor': [35.3333, 40.1500],
  'Al-Hasakah':  [36.5000, 40.7500],
  'Rif Dimashq': [33.5167, 36.3000],
  'Homs':        [34.7333, 36.7167],
  'Daraa':       [32.6189, 36.1021],
  'Hama':        [35.1318, 36.7578],
  'Ar-Raqqah':   [35.9500, 39.0167],
  'Quneitra':    [33.1256, 35.8244],
  'Latakia':     [35.5167, 35.7833],
  'As-Suwayda':  [32.7000, 36.5667],
  'Tartus':      [34.8833, 35.8833],
  'Damascus':    [33.5138, 36.2765],
}

// Approximate Syria bounds for default map view
export const SYRIA_BOUNDS: [[number, number], [number, number]] = [
  [32.3,  35.7],  // SW
  [37.4,  42.4],  // NE
]

export const SYRIA_CENTER: [number, number] = [34.8, 38.5]
