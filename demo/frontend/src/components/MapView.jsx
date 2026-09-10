import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, LayersControl, Polyline, CircleMarker, Tooltip, Marker, useMap, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import trackGeometry from '../assets/track_geometry.json';

const STATIONS = [
  { code: 'AJJ', name: 'Arakkonam Jn', lat: 13.0846, lon: 79.6705, km: 0 },
  { code: 'SHU', name: 'Sholinghur', lat: 13.1192, lon: 79.4201, km: 21.3 },
  { code: 'WJR', name: 'Walajah Road Jn', lat: 12.9368, lon: 79.3354, km: 36.2 },
  { code: 'MCN', name: 'Mukundarayapuram', lat: 12.9241, lon: 79.2484, km: 43.9 },
  { code: 'KPD', name: 'Katpadi Jn', lat: 12.9690, lon: 79.1400, km: 60.9 },
  { code: 'GYM', name: 'Gudiyattam', lat: 12.9463, lon: 78.8723, km: 85.6 },
  { code: 'AB', name: 'Ambur', lat: 12.7916, lon: 78.7162, km: 113.0 },
  { code: 'VN', name: 'Vaniyambadi', lat: 12.6816, lon: 78.6204, km: 129.1 },
  { code: 'JTJ', name: 'Jolarpettai Jn', lat: 12.5707, lon: 78.5736, km: 144.5 },
];

const SECTIONS = [
  'AJJ-SHU', 'SHU-WJR', 'WJR-MCN', 'MCN-KPD', 'KPD-GYM', 'GYM-AB', 'AB-VN', 'VN-JTJ'
];

const STATE_COLORS = {
  clear: '#1E7A34',
  occupied: '#8A5A00',
  maintenance: '#B3261E',
  reserved: '#0B5FA5',
  caution: '#8A5A00',
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
  const color = isWaiting ? STATE_COLORS.occupied : '#0B3C6B'; // Brand primary for active trains
  const pulseHtml = isWaiting ? `<div class="absolute -inset-1.5 rounded-full animate-ping bg-[#FCEFC7] opacity-100"></div>` : '';
  
  return L.divIcon({
    className: 'bg-transparent border-none',
    html: `
      <div class="relative flex items-center justify-center w-4 h-4">
        ${pulseHtml}
        <div class="w-3 h-3 rounded-sm transform rotate-45 z-10" style="background-color: ${color}; border: 1px solid #FFFFFF; box-shadow: 0 1px 2px rgba(0,0,0,0.2);"></div>
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
    if (!currentSection) return null;
    
    const fromStation = STATIONS.find(s => s.code === currentSection.from.code || s.code === currentSection.id.split('-')[0]);
    const toStation = STATIONS.find(s => s.code === currentSection.to.code || s.code === currentSection.id.split('-')[1]);
    
    if (!fromStation || !toStation) return null;
    
    const sectionLength = toStation.km - fromStation.km || 1;
    let progress = (train.km - fromStation.km) / sectionLength;
    progress = Math.max(0, Math.min(1, progress));
    
    const pathData = trackGeometry[currentSection.id];
    let path = null;
    if (pathData) {
      // Use UP or DOWN track based on train direction. Fallback to center if not available.
      path = train.direction === 'UP' ? pathData.up : pathData.down;
      if (!path) path = pathData.center || pathData; // backward compatibility
    }
    
    if (path && path.length > 1) {
      // For DOWN trains, the path nodes are still ordered from UP direction (Start station to End station).
      // So progress goes from 1 to 0 if the train is actually moving DOWN the corridor?
      // Wait, in simulator, direction DOWN means km goes UP or DOWN? 
      // The stations are AJJ (0km) to JTJ (144km). UP trains usually go towards Chennai (km goes down to 0).
      // Wait, in simulator.ts, direction === 'UP' ? 1 : -1. So UP means km goes UP.
      
      const totalSegments = path.length - 1;
      const exactIndex = progress * totalSegments;
      const segmentIndex = Math.floor(exactIndex);
      const segmentProgress = exactIndex - segmentIndex;
      
      if (segmentIndex >= totalSegments) return path[totalSegments];
      
      const p1 = path[segmentIndex];
      const p2 = path[segmentIndex + 1];
      
      return [
        p1[0] + (p2[0] - p1[0]) * segmentProgress,
        p1[1] + (p2[1] - p1[1]) * segmentProgress
      ];
    } else {
      const lat = fromStation.lat + (toStation.lat - fromStation.lat) * progress;
      const lon = fromStation.lon + (toStation.lon - fromStation.lon) * progress;
      return [lat, lon];
    }
  }, [train.km, train.direction, train.heldSectionIds, train.nextSectionId, network]);

  if (!position) return null;

  return (
    <Marker 
      position={position} 
      icon={createTrainIcon(train.status)}
      zIndexOffset={1000}
    >
      <Popup className="train-popup text-[12px] font-sans">
        <div className="text-text-primary p-1">
          <strong className="text-[14px]">Train {train.id}</strong><br/>
          <span className="text-text-secondary">Speed:</span> <span className="num">{train.speedKmh.toFixed(0)} km/h</span><br/>
          <span className="text-text-secondary">Delay:</span> <span className="num">{train.delayMinutes ? train.delayMinutes.toFixed(1) : 0} min</span><br/>
          <span className="text-text-secondary">Status:</span> <span className="uppercase font-medium" style={{ color: train.status === 'stopped' ? STATE_COLORS.occupied : STATE_COLORS.clear }}>{train.status}</span>
        </div>
      </Popup>
    </Marker>
  );
}


export default function MapView({ world, network, setSelectedDetail }) {
  const sections = world?.sections || [];
  const trains = world?.trains || [];

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-0 left-0 right-0 z-[1000] p-3 flex justify-between items-center pointer-events-none">
        <div>
          <span className="text-[10px] font-semibold tracking-wider text-brand uppercase bg-surface/80 backdrop-blur px-2 py-0.5 rounded-sm border border-border-default">LIVE MAP</span>
        </div>
        <div className="text-[10px] font-semibold tracking-wider text-success bg-surface/90 backdrop-blur px-2 py-1 rounded-sm border border-border-default pointer-events-auto flex items-center shadow-sm">
          <span className="w-2 h-2 rounded-full bg-success mr-1.5 animate-pulse"></span>
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
          <LayersControl.BaseLayer checked name="Standard OSM">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite (Esri)">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
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
            <React.Fragment key={sectionId}>
              {/* UP Line (Blue) */}
              <Polyline
                positions={trackGeometry[sectionId]?.up || [[fromSt.lat, fromSt.lon], [toSt.lat, toSt.lon]]}
                color="#0B5FA5"
                weight={3}
                lineCap="square"
                lineJoin="miter"
                className="transition-all duration-300 ease-in-out"
                eventHandlers={{
                  click: () => setSelectedDetail({ type: 'section', data: sectionData || { id: sectionId } })
                }}
              />
              {/* DOWN Line (Orange/Red) */}
              <Polyline
                positions={trackGeometry[sectionId]?.down || [[fromSt.lat, fromSt.lon], [toSt.lat, toSt.lon]]}
                color={color === STATE_COLORS.clear ? "#B85D19" : color} // If clear, draw DOWN line orange. Else use fault color.
                weight={3}
                lineCap="square"
                lineJoin="miter"
                className="transition-all duration-300 ease-in-out"
                eventHandlers={{
                  click: () => setSelectedDetail({ type: 'section', data: sectionData || { id: sectionId } })
                }}
              />
              {/* Invisible thick line for easier clicking */}
              <Polyline
                positions={trackGeometry[sectionId]?.center || [[fromSt.lat, fromSt.lon], [toSt.lat, toSt.lon]]}
                color="transparent"
                weight={15}
                eventHandlers={{
                  click: () => setSelectedDetail({ type: 'section', data: sectionData || { id: sectionId } })
                }}
              />
              
              {/* Visual Candy for Maintenance/Faults (Transparent Shadow Block) */}
              {(sectionData?.fault || sectionData?.state === 'maintenance') && (
                <Polyline
                  positions={trackGeometry[sectionId]?.center || [[fromSt.lat, fromSt.lon], [toSt.lat, toSt.lon]]}
                  color={STATE_COLORS.maintenance}
                  opacity={0.3}
                  weight={25}
                  className="animate-pulse pointer-events-none transition-all duration-500 ease-in-out"
                />
              )}
            </React.Fragment>
          );
        })}

        {/* Station Markers */}
        {STATIONS.map(station => {
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
              fillColor="#FFFFFF"
              fillOpacity={1}
              color={ringColor}
              weight={3}
              eventHandlers={{
                click: () => setSelectedDetail({ type: 'station', data: station })
              }}
            >
              <Tooltip 
                permanent 
                direction="bottom" 
                className="bg-transparent border-none shadow-none text-text-primary font-sans text-[11px] font-bold"
                offset={[0, 6]}
              >
                <div style={{ textShadow: '0 1px 2px white, 0 -1px 2px white, 1px 0 2px white, -1px 0 2px white' }}>
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
