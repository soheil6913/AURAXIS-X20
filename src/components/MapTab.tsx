import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ScanRecord } from '../types';
import {
  MapPin,
  Navigation,
  Layers,
  Search,
  Download,
  Share2,
  Box,
  Sparkles,
  Compass,
  CheckCircle2,
  Info,
  Maximize2,
  Globe,
  Radio,
  FileCode
} from 'lucide-react';

interface MapTabProps {
  scans: ScanRecord[];
  onSelectScan: (scan: ScanRecord) => void;
  onNavigateToAiWithScan: (scan: ScanRecord) => void;
  onUpdateScanCoordinates?: (scanId: string, lat: number, lng: number) => void;
  viewedScan: ScanRecord | null;
}

type TileLayerType = 'osm' | 'satellite' | 'topo';

export const MapTab: React.FC<MapTabProps> = ({
  scans,
  onSelectScan,
  onNavigateToAiWithScan,
  onUpdateScanCoordinates,
  viewedScan
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [activeLayer, setActiveLayer] = useState<TileLayerType>('satellite');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [selectedScanOnMap, setSelectedScanOnMap] = useState<ScanRecord | null>(viewedScan || scans[0] || null);
  const [pinMode, setPinMode] = useState<boolean>(false);
  const [pinnedCoords, setPinnedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(!navigator.onLine);

  // Track offline status
  useEffect(() => {
    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Custom Icon Factory
  const createCustomMarkerIcon = (scan: ScanRecord, isSelected: boolean) => {
    const maxVal = Math.max(...(scan.gridData || [0]));
    let colorClass = 'bg-amber-400 text-slate-950 border-amber-300 shadow-amber-400/40';
    if (maxVal < 250) {
      colorClass = 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-cyan-400/40';
    } else if (maxVal > 750) {
      colorClass = 'bg-amber-400 text-slate-950 border-amber-200 shadow-amber-400/60 ring-2 ring-amber-300 animate-pulse';
    }

    const html = `
      <div class="relative flex items-center justify-center">
        <div class="w-8 h-8 rounded-full border-2 ${colorClass} shadow-lg flex items-center justify-center font-black text-xs transition-all ${isSelected ? 'scale-125 ring-4 ring-cyan-400' : 'hover:scale-110'}">
          ${scan.id.split('-')[1] || 'S'}
        </div>
        <div class="absolute -bottom-1.5 w-2 h-2 bg-slate-900 border border-slate-700 rotate-45"></div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-map-pin',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center around Iran archaeological region if coordinates exist
      const defaultLat = viewedScan?.coordinates?.lat || scans[0]?.coordinates?.lat || 35.6892;
      const defaultLng = viewedScan?.coordinates?.lng || scans[0]?.coordinates?.lng || 51.3890;

      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 7,
        zoomControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
      markersGroupRef.current = L.layerGroup().addTo(map);

      // Handle map click for manual pinning
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setPinnedCoords({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attribution = '&copy; OpenStreetMap contributors';

    if (activeLayer === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Esri, Maxar, Earthstar Geographics';
    } else if (activeLayer === 'topo') {
      tileUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      attribution = '&copy; OpenTopoMap';
    }

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution,
      errorTileUrl: '' // Graceful fallback
    }).addTo(map);
  }, [activeLayer]);

  // Render Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    scans.forEach((scan) => {
      if (scan.coordinates) {
        const isSelected = selectedScanOnMap?.id === scan.id;
        const icon = createCustomMarkerIcon(scan, isSelected);
        const marker = L.marker([scan.coordinates.lat, scan.coordinates.lng], { icon });

        marker.on('click', () => {
          setSelectedScanOnMap(scan);
        });

        const maxVal = Math.max(...(scan.gridData || [0]));

        const popupContent = document.createElement('div');
        popupContent.className = 'p-3 text-right dir-rtl font-sans bg-slate-900 text-white rounded-xl border border-slate-800 shadow-2xl space-y-2 min-w-[200px]';
        popupContent.innerHTML = `
          <div class="font-bold text-amber-400 text-sm">${scan.name}</div>
          <div class="text-xs text-slate-300">تاریخ: ${scan.date}</div>
          <div class="text-xs text-slate-400 flex items-center justify-between">
            <span>نوع خاک: ${scan.soilType}</span>
            <span class="text-cyan-400 font-mono font-bold">${maxVal} ADC</span>
          </div>
          <div class="text-xs text-slate-400 font-mono">مختصات: ${scan.coordinates.lat.toFixed(4)}, ${scan.coordinates.lng.toFixed(4)}</div>
        `;

        marker.bindPopup(popupContent);
        markersGroup.addLayer(marker);
      }
    });

    // If pinned coordinates exist
    if (pinnedCoords) {
      const pinIcon = L.divIcon({
        html: `
          <div class="w-8 h-8 rounded-full bg-cyan-400 border-2 border-white shadow-lg flex items-center justify-center text-slate-950 font-black animate-bounce">
            📍
          </div>
        `,
        className: 'custom-pin-drop',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });
      const pinMarker = L.marker([pinnedCoords.lat, pinnedCoords.lng], { icon: pinIcon });
      markersGroup.addLayer(pinMarker);
    }
  }, [scans, selectedScanOnMap, pinnedCoords]);

  // Locate User GPS
  const handleLocateUser = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = Number(position.coords.latitude.toFixed(6));
          const lng = Number(position.coords.longitude.toFixed(6));
          setUserLocation({ lat, lng });
          setIsLocating(false);

          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([lat, lng], 14, { duration: 1.5 });

            if (userMarkerRef.current) {
              userMarkerRef.current.setLatLng([lat, lng]);
            } else {
              const userIcon = L.divIcon({
                html: `
                  <div class="relative flex items-center justify-center">
                    <div class="w-5 h-5 bg-cyan-400 rounded-full border-2 border-white shadow-lg animate-ping absolute"></div>
                    <div class="w-4 h-4 bg-cyan-500 rounded-full border-2 border-white shadow-md relative"></div>
                  </div>
                `,
                className: 'user-gps-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              });
              userMarkerRef.current = L.marker([lat, lng], { icon: userIcon }).addTo(mapInstanceRef.current);
            }
          }
        },
        (error) => {
          console.warn('Geolocation error:', error);
          setIsLocating(false);
          alert('امکان دریافت موقعیت GPS وجود ندارد. لطفاً دسترسی به GPS را روشن کنید.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setIsLocating(false);
      alert('مرورگر شما از GPS پشتیبانی نمی‌کند.');
    }
  };

  // Center on Scan
  const handleFocusScanOnMap = (scan: ScanRecord) => {
    setSelectedScanOnMap(scan);
    if (scan.coordinates && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([scan.coordinates.lat, scan.coordinates.lng], 12, { duration: 1.2 });
    }
  };

  // Save pinned location to current selected scan
  const handleSavePinToScan = () => {
    if (selectedScanOnMap && pinnedCoords && onUpdateScanCoordinates) {
      onUpdateScanCoordinates(selectedScanOnMap.id, pinnedCoords.lat, pinnedCoords.lng);
      setPinnedCoords(null);
    }
  };

  // Export GPX / GeoJSON file
  const handleExportGeoJson = () => {
    const geojson = {
      type: 'FeatureCollection',
      features: scans.map((s) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: s.coordinates ? [s.coordinates.lng, s.coordinates.lat] : [51.389, 35.689]
        },
        properties: {
          id: s.id,
          name: s.name,
          date: s.date,
          soilType: s.soilType,
          maxDepthMeters: s.maxDepthMeters,
          maxAdc: Math.max(...(s.gridData || [0]))
        }
      }))
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OKM_3D_Scans_GIS_${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 dir-rtl">
      {/* Top Header Control Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-400/20">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white">نقشه جغرافیایی ژئوفیزیک (GIS Map Layer)</h2>
              {isOfflineMode ? (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-mono">
                  آفلاین (Offline Cache)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
                  آنلاین (OSM/Esri Satellite)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">ثبت موقعیت جغرافیایی نقطه‌زنی و آرشیو منطقه‌ای اسکن‌های زمین</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handleLocateUser}
            disabled={isLocating}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
          >
            <Navigation className={`w-4 h-4 text-cyan-400 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'در حال جستجوی GPS...' : 'موقعیت من (GPS)'}</span>
          </button>

          <button
            onClick={handleExportGeoJson}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>خروجی GIS / GeoJSON</span>
          </button>
        </div>
      </div>

      {/* Main Map Container + Side Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Interactive Map View (8 Cols) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative min-h-[480px] lg:min-h-[560px] flex flex-col">
          
          {/* Map Layer Switcher Toolbar Overlay */}
          <div className="absolute top-4 right-4 z-[400] bg-slate-950/85 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-1">
            <button
              onClick={() => setActiveLayer('satellite')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                activeLayer === 'satellite'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ماهواره‌ای (Satellite)
            </button>
            <button
              onClick={() => setActiveLayer('osm')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                activeLayer === 'osm'
                  ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              نقشه عمومی (OSM)
            </button>
            <button
              onClick={() => setActiveLayer('topo')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                activeLayer === 'topo'
                  ? 'bg-emerald-400 text-slate-950 shadow-md shadow-emerald-400/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              توپوگرافی (Topo)
            </button>
          </div>

          {/* Pin Drop Mode Banner */}
          {pinnedCoords && (
            <div className="absolute top-4 left-4 z-[400] bg-cyan-950/90 border border-cyan-500/50 text-cyan-200 p-3 rounded-2xl shadow-xl flex items-center gap-3 backdrop-blur-md max-w-sm">
              <MapPin className="w-5 h-5 text-cyan-400 shrink-0" />
              <div className="text-xs">
                <div className="font-bold">نقطه جدید روی نقشه علامت‌گذاری شد</div>
                <div className="font-mono text-[11px] text-cyan-300">{pinnedCoords.lat}, {pinnedCoords.lng}</div>
              </div>
              <button
                onClick={handleSavePinToScan}
                className="px-3 py-1.5 bg-cyan-400 text-slate-950 rounded-xl font-bold text-xs hover:bg-cyan-300 transition shrink-0"
              >
                ثبت روی اسکن
              </button>
            </div>
          )}

          {/* Leaflet Map Target Div */}
          <div ref={mapContainerRef} className="w-full h-full min-h-[480px] lg:min-h-[560px] z-10" />

          {/* Bottom Coordinates Bar */}
          <div className="bg-slate-950 border-t border-slate-800 p-3 flex items-center justify-between text-xs text-slate-400 font-mono z-20">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-amber-400" />
              <span>مختصات فعال: {selectedScanOnMap?.coordinates ? `${selectedScanOnMap.coordinates.lat}, ${selectedScanOnMap.coordinates.lng}` : 'انتخاب نشده'}</span>
            </div>
            <div>تعداد اسکن‌های نشان‌شده: {scans.filter(s => s.coordinates).length} از {scans.length}</div>
          </div>
        </div>

        {/* Scan Selection & Details Side Panel (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Selected Scan Detail Card */}
          {selectedScanOnMap ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400 font-mono">{selectedScanOnMap.id}</span>
                </div>
                <span className="text-xs text-slate-400">{selectedScanOnMap.date}</span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white mb-1">{selectedScanOnMap.name}</h3>
                <p className="text-xs text-slate-400">{selectedScanOnMap.notes || 'بدون توضیحات تکمیلی'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-955 p-3 rounded-2xl border border-slate-800 font-mono">
                <div>
                  <span className="text-slate-500 block">عرض × طول:</span>
                  <span className="text-white font-bold">{selectedScanOnMap.width} × {selectedScanOnMap.length}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">عمق تخمینی:</span>
                  <span className="text-cyan-400 font-bold">{selectedScanOnMap.maxDepthMeters} متر</span>
                </div>
                <div>
                  <span className="text-slate-500 block">بستر خاک:</span>
                  <span className="text-slate-300">{selectedScanOnMap.soilType.split(' ')[0]}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">مختصات:</span>
                  <span className="text-amber-400">
                    {selectedScanOnMap.coordinates
                      ? `${selectedScanOnMap.coordinates.lat.toFixed(2)}, ${selectedScanOnMap.coordinates.lng.toFixed(2)}`
                      : 'ثبت نشده'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => onSelectScan(selectedScanOnMap)}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-xl text-xs font-bold transition shadow-lg shadow-cyan-400/20"
                >
                  <Box className="w-4 h-4" />
                  <span>نمایش سه‌بعدی</span>
                </button>

                <button
                  onClick={() => onNavigateToAiWithScan(selectedScanOnMap)}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-bold transition shadow-lg shadow-amber-400/20"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>تحلیل AI</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center text-slate-400 text-xs">
              یک اسکن را از لیست یا روی نقشه انتخاب کنید.
            </div>
          )}

          {/* List of Scans for Quick Focus */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3 shadow-xl max-h-[320px] overflow-y-auto no-scrollbar">
            <div className="text-xs font-bold text-white flex items-center justify-between border-b border-slate-800 pb-2">
              <span>لیست تمام اسکن‌ها</span>
              <span className="text-slate-500 text-[11px]">{scans.length} اسکن</span>
            </div>

            <div className="space-y-2">
              {scans.map((scan) => (
                <div
                  key={scan.id}
                  onClick={() => handleFocusScanOnMap(scan)}
                  className={`p-3 rounded-2xl border text-xs cursor-pointer transition flex items-center justify-between ${
                    selectedScanOnMap?.id === scan.id
                      ? 'bg-amber-400/10 border-amber-400/50 text-white'
                      : 'bg-slate-955 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-bold text-slate-100">{scan.name}</div>
                    <div className="text-[10px] text-slate-400">{scan.date} | {scan.soilType}</div>
                  </div>
                  <MapPin className={`w-4 h-4 ${scan.coordinates ? 'text-amber-400' : 'text-slate-600'}`} />
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
