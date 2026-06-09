import 'leaflet'

declare module 'leaflet' {
  interface HeatLayerOptions {
    minOpacity?: number
    maxZoom?: number
    max?: number
    radius?: number
    blur?: number
    gradient?: Record<number, string>
  }

  class HeatLayer extends Layer {
    setLatLngs(latlngs: Array<[number, number] | [number, number, number] | LatLng>): this
    addLatLng(latlng: [number, number] | [number, number, number] | LatLng): this
    setOptions(options: HeatLayerOptions): this
    redraw(): this
  }

  function heatLayer(
    latlngs: Array<[number, number] | [number, number, number] | LatLng>,
    options?: HeatLayerOptions
  ): HeatLayer
}
