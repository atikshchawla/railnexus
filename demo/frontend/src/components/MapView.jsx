import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, LayersControl, Polyline, CircleMarker, Tooltip, Marker, useMap, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const STATIONS = [
  { code: 'AJJ', name: 'Arakkonam Jn', lat: 13.0819, lon: 79.6685, km: 0 },
  { code: 'SHU', name: 'Sholinghur', lat: 13.0000, lon: 79.4500, km: 21.3 },
  { code: 'WJR', name: 'Walajah Road Jn', lat: 12.9350, lon: 79.3550, km: 36.2 },
  { code: 'MCN', name: 'Mukundarayapuram', lat: 12.9200, lon: 79.2600, km: 43.9 },
  { code: 'KPD', name: 'Katpadi Jn', lat: 12.9722, lon: 79.1383, km: 60.9 },
  { code: 'GYM', name: 'Gudiyattam', lat: 12.9450, lon: 78.8700, km: 85.6 },
  { code: 'AB', name: 'Ambur', lat: 12.7900, lon: 78.7150, km: 113.0 },
  { code: 'VN', name: 'Vaniyambadi', lat: 12.6785, lon: 78.6217, km: 129.1 },
  { code: 'JTJ', name: 'Jolarpettai Jn', lat: 12.5593, lon: 78.5767, km: 144.5 }, // Adjust JTJ km if not provided (was not in TRAIN_KM but is end)
];

const SECTIONS = [
  'AJJ-SHU', 'SHU-WJR', 'WJR-MCN', 'MCN-KPD', 'KPD-GYM', 'GYM-AB', 'AB-VN', 'VN-JTJ'
];

const STATE_COLORS = {
  clear: '#3ddc84',
  occupied: '#f5a623',
  maintenance: '#e5484d',
  reserved: '#5b8def',
  caution: '#f5a623',
};

// Auto-fit bounds component
function FitBounds({ stations }) {
  const map = useMap();
  useEffect(() => {
    if (stations.length > 0) {
      const bounds = L.latLngBounds(stations.map(s => [s.lat, s.lon]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, stations]);
  return null;
}

function getSectionColor(sectionState, fault) {
  if (fault || sectionState === 'maintenance') return STATE_COLORS.maintenance;
  if (sectionState === 'reserved') return STATE_COLORS.reserved;
  if (sectionState === 'occupied') return STATE_COLORS.occupied;
  return STATE_COLORS.clear;
}

// Custom Train Icon
const createTrainIcon = (status) => {
  const isWaiting = status === 'stopped' || status === 'waiting';
  const color = isWaiting ? STATE_COLORS.occupied : '#e8eef1';
  const pulseHtml = isWaiting ? `<div class="absolute -inset-2 rounded-full animate-ping bg-[#f5a623] opacity-75"></div>` : '';
  
  return L.divIcon({
    className: 'bg-transparent border-none',
    html: `
      <div class="relative flex items-center justify-center w-4 h-4">
        ${pulseHtml}
        <div class="w-3 h-3 rounded-sm transform rotate-45 z-10" style="background-color: ${color}; border: 1px solid #081216; box-shadow: 0 0 5px ${color};"></div>
      </div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
};

function TrainMarker({ train, network }) {
  // Interpolate position
  const position = useMemo(() => {
    const currentSection = network?.sections?.find(s => s.id === train.heldSectionIds[0] || s.id === train.nextSectionId);
    
    // Find stations matching the section
    if (!currentSection) return null;
    
    // We can use the STATIONS constant directly instead to be robust
    const fromStation = STATIONS.find(s => s.code === currentSection.from.code || s.code === currentSection.id.split('-')[0]);
    const toStation = STATIONS.find(s => s.code === currentSection.to.code || s.code === currentSection.id.split('-')[1]);
    
    if (!fromStation || !toStation) return null;
    
    // Raw world feed schema gives train.position_km *relative* to the section
    // In app.js it was train.km = from.km + train.position_km.
    // The useDemoState normalizes this into train.km.
    
    const sectionLength = toStation.km - fromStation.km || 1;
    let progress = (train.km - fromStation.km) / sectionLength;
    progress = Math.max(0, Math.min(1, progress));
    
    const lat = fromStation.lat + (toStation.lat - fromStation.lat) * progress;
    const lon = fromStation.lon + (toStation.lon - fromStation.lon) * progress;
    
    return [lat, lon];
  }, [train.km, train.heldSectionIds, train.nextSectionId, network]);

  if (!position) return null;

  return (
    <Marker 
      position={position} 
      icon={createTrainIcon(train.status)}
      zIndexOffset={1000}
    >
      <Popup className="train-popup">
        <div className="font-mono text-xs text-slate-800">
          <strong>Train {train.id}</strong><br/>
          Speed: {train.speedKmh.toFixed(0)} km/h<br/>
          Delay: {train.delayMinutes ? train.delayMinutes.toFixed(1) : 0} min<br/>
          Status: <span className="uppercase">{train.status}</span>
        </div>
      </Popup>
    </Marker>
  );
}


export default function MapView({ world, network, setSelectedDetail }) {
  const sections = world?.sections || [];
  const trains = world?.trains || [];

  return (
    <div className="w-full h-full min-h-[500px] bg-[#0a171b] border border-[#26383e] rounded-lg overflow-hidden relative shadow-[0_16px_35px_rgba(0,0,0,0.14)]">
      <div className="absolute top-0 left-0 right-0 z-[1000] p-4 flex justify-between items-center pointer-events-none">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#55e6a5]">LIVE CONTROL OFFICE</span>
          <h2 className="text-sm font-semibold text-[#e8eef1] m-0">AJJ–JTJ network state</h2>
        </div>
        <div className="text-[10px] font-mono tracking-widest text-[#55e6a5] bg-[#081216]/80 px-2 py-1 rounded border border-[#26383e] pointer-events-auto flex items-center">
          <span className="w-2 h-2 rounded-full bg-[#55e6a5] shadow-[0_0_8px_#55e6a5] mr-2"></span>
          LIVE FEED
        </div>
      </div>
      
      <MapContainer 
        center={[12.9, 79.1]} 
        zoom={10} 
        scrollWheelZoom={true} 
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <FitBounds stations={STATIONS} />
        
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="CartoDB Dark Matter">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite (Esri)">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Standard OSM">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {/* Polylines for sections */}
        {SECTIONS.map(sectionId => {
          const [fromCode, toCode] = sectionId.split('-');
          const fromSt = STATIONS.find(s => s.code === fromCode);
          const toSt = STATIONS.find(s => s.code === toCode);
          if (!fromSt || !toSt) return null;
          
          const sectionData = sections.find(s => s.id === sectionId);
          const color = sectionData ? getSectionColor(sectionData.state, sectionData.fault) : STATE_COLORS.clear;
          
          return (
            <Polyline
              key={sectionId}
              positions={[[fromSt.lat, fromSt.lon], [toSt.lat, toSt.lon]]}
              color={color}
              weight={5}
              lineCap="round"
              lineJoin="round"
              className="transition-all duration-300 ease-in-out"
              eventHandlers={{
                click: () => setSelectedDetail({ type: 'section', data: sectionData || { id: sectionId } })
              }}
            />
          );
        })}

        {/* Station Markers */}
        {STATIONS.map(station => {
          // Find if any adjacent section is occupied/faulty to color the ring
          const adjSections = sections.filter(s => s.id.includes(station.code));
          const hasFault = adjSections.some(s => s.fault || s.state === 'maintenance');
          const hasOccupied = adjSections.some(s => s.state === 'occupied');
          const hasReserved = adjSections.some(s => s.state === 'reserved');
          
          let ringColor = STATE_COLORS.clear;
          if (hasFault) ringColor = STATE_COLORS.maintenance;
          else if (hasOccupied) ringColor = STATE_COLORS.occupied;
          else if (hasReserved) ringColor = STATE_COLORS.reserved;

          return (
            <CircleMarker
              key={station.code}
              center={[station.lat, station.lon]}
              radius={6}
              fillColor="#0b171a"
              fillOpacity={1}
              color={ringColor}
              weight={2}
              eventHandlers={{
                click: () => setSelectedDetail({ type: 'station', data: station })
              }}
            >
              <Tooltip 
                permanent 
                direction="bottom" 
                className="bg-transparent border-none shadow-none text-[#dbe8e9] font-mono text-[11px] font-semibold"
                offset={[0, 5]}
              >
                <div style={{ textShadow: '0 0 2px #081216, 0 0 2px #081216' }}>
                  {station.code}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* Trains */}
        {trains.map(train => (
          <TrainMarker key={train.id} train={train} network={network} />
        ))}

      </MapContainer>
    </div>
  );
}
