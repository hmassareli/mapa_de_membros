import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

function getMarkerColor(familia) {
  if (familia.status === 'mudou') return '#8b5cf6'
  if (familia.status === 'desconhecido') return '#6b7280'
  if (familia.status === 'ativo') return '#10b981'
  if (familia.status === 'inativo') {
    if (familia.aceita_visitas === 'sim') return '#ef4444'
    if (familia.aceita_visitas === 'nao') return '#f59e0b'
    return '#ef4444'
  }
  return '#3b82f6'
}

function isRecentlyVisited(familia) {
  if (!familia.ultima_visita) return false
  const diff = (new Date() - new Date(familia.ultima_visita)) / (1000 * 60 * 60 * 24)
  return diff <= 30
}

const MapView = forwardRef(function MapView({ familias, onMarkerClick, pinMode, onMapClickPin }, ref) {
  const containerRef = useRef(null)
  const mapInstance = useRef(null)
  const markersLayerRef = useRef(null)
  const pinModeRef = useRef(pinMode)
  const onMapClickPinRef = useRef(onMapClickPin)
  const tempMarkerRef = useRef(null)

  // Keep refs in sync
  pinModeRef.current = pinMode
  onMapClickPinRef.current = onMapClickPin

  useImperativeHandle(ref, () => ({
    flyTo: (latlng, zoom, options) => {
      mapInstance.current?.flyTo(latlng, zoom, options)
    },
  }))

  // Init map
  useEffect(() => {
    if (mapInstance.current) return

    const map = L.map(containerRef.current, {
      center: [-23.2237, -45.9009],
      zoom: 13,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    const markers = L.markerClusterGroup({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction(cluster) {
        const count = cluster.getChildCount()
        let size = 'small'
        if (count >= 20) size = 'large'
        else if (count >= 10) size = 'medium'
        return L.divIcon({
          html: `<div class="cluster-icon cluster-${size}">${count}</div>`,
          className: 'custom-cluster',
          iconSize: [40, 40],
        })
      },
    })

    map.addLayer(markers)

    // Pin mode click handler
    map.on('click', (e) => {
      if (!pinModeRef.current) return
      const { lat, lng } = e.latlng
      if (tempMarkerRef.current) map.removeLayer(tempMarkerRef.current)
      tempMarkerRef.current = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: '<div class="temp-marker" style="width:18px;height:18px;"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map)
      onMapClickPinRef.current?.(lat, lng)
    })

    mapInstance.current = map
    markersLayerRef.current = markers

    return () => {
      map.remove()
      mapInstance.current = null
    }
  }, [])

  // Update pin mode class
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (pinMode) {
      el.classList.add('pin-mode')
    } else {
      el.classList.remove('pin-mode')
      if (tempMarkerRef.current && mapInstance.current) {
        mapInstance.current.removeLayer(tempMarkerRef.current)
        tempMarkerRef.current = null
      }
    }
  }, [pinMode])

  // Update markers
  useEffect(() => {
    if (!markersLayerRef.current) return
    markersLayerRef.current.clearLayers()

    familias.forEach((familia) => {
      if (!familia.latitude || !familia.longitude) return

      const color = getMarkerColor(familia)
      const recent = isRecentlyVisited(familia)
      const size = recent ? 16 : 12

      const marker = L.marker([familia.latitude, familia.longitude], {
        icon: L.divIcon({
          className: '',
          html: `<div class="custom-marker ${recent ? 'marker-recent' : ''}" style="width:${size}px;height:${size}px;background:${color};"></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
      })

      marker.bindTooltip(
        `<strong>${familia.nome_familia}</strong><br>
         <small>${familia.endereco_linha1 || ''}</small><br>
         <small>${familia.total_membros} membro(s) | ${familia.total_visitas || 0} visita(s)</small>`,
        { direction: 'top', offset: [0, -10], className: 'familia-tooltip' }
      )

      marker.on('click', () => onMarkerClick(familia.id))
      markersLayerRef.current.addLayer(marker)
    })
  }, [familias, onMarkerClick])

  return <div id="map" ref={containerRef} />
})

export default MapView
