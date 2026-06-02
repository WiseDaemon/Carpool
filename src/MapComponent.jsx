import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const createCustomIcon = (color) => {
  return new L.DivIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
};

const pickupIcon = createCustomIcon('#029676'); // Reliance Teal
const dropoffIcon = createCustomIcon('#FF4A4A'); // Danger Red

const carIcon = new L.DivIcon({
  className: 'custom-car-icon',
  html: `<div style="background-color: #f59e0b; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; font-size: 16px;">🚗</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const LocationSelector = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      if (onLocationSelect) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

export const MapBoundsUpdater = ({ pickup, dropoff }) => {
  const map = useMap();
  useEffect(() => {
    if (pickup && dropoff) {
      const bounds = L.latLngBounds(
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng]
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (pickup) {
      map.flyTo([pickup.lat, pickup.lng], 13);
    } else if (dropoff) {
      map.flyTo([dropoff.lat, dropoff.lng], 13);
    }
  }, [pickup, dropoff, map]);
  return null;
};

// ... keep AutocompleteInput as it was ...
let RCP_LOCATIONS = [
  { name: 'RCP Twin Towers', lat: 19.1171, lng: 73.0106 },
  { name: 'RCP LDC', lat: 19.1175, lng: 73.0110 },
  { name: 'RCP Main Gate', lat: 19.1160, lng: 73.0090 },
];

for (let i = 1; i <= 30; i++) {
  RCP_LOCATIONS.push({ name: `RCP TC ${i}`, lat: 19.1172 + (i * 0.0001), lng: 73.0107 });
}

['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach((gate, idx) => {
  RCP_LOCATIONS.push({ name: `RCP Gate ${gate}`, lat: 19.1165 + (idx * 0.0002), lng: 73.0095 });
});

import { useState } from 'react';
export const AutocompleteInput = ({ label, placeholder, value, onChange, onSelect, color }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  useEffect(() => {
    setFocusedIndex(-1);
    const delayDebounceFn = setTimeout(async () => {
      if (value && showDropdown) {
        let results = [];
        
        if (value.toLowerCase().includes('rcp') || value.toLowerCase().includes('gate') || value.toLowerCase().includes('tc')) {
          const rcpMatches = RCP_LOCATIONS.filter(loc => loc.name.toLowerCase().includes(value.toLowerCase())).map(loc => ({
             properties: { name: loc.name, city: 'Ghansoli', state: 'Navi Mumbai', isCustom: true },
             geometry: { coordinates: [loc.lng, loc.lat] }
          }));
          results = [...rcpMatches];
        }

        try {
          const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&limit=5&lat=19.0760&lon=72.8777`);
          const data = await res.json();
          results = [...results, ...(data.features || [])];
          
          // Sort results alphabetically by name
          results.sort((a, b) => {
            const nameA = a.properties.name || '';
            const nameB = b.properties.name || '';
            return nameA.localeCompare(nameB);
          });
          
          setSuggestions(results.slice(0, 8));
        } catch (error) {
          console.error(error);
        }
      } else {
        setSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [value, showDropdown]);

  const handleSelect = (suggestion) => {
    setShowDropdown(false);
    const props = suggestion.properties;
    const shortName = props.name || props.city || props.state || 'Selected Location';
    onChange(shortName);
    onSelect({
      lat: suggestion.geometry.coordinates[1],
      lng: suggestion.geometry.coordinates[0],
      name: shortName
    });
  };

  return (
    <div className="flex flex-col gap-2 relative w-full">
      <label className="text-xs text-on-surface-variant font-medium">{label}</label>
      <div className="flex w-full">
        <div className="px-3 bg-surface-container/60 border border-r-0 border-white/10 rounded-l-lg flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></div>
        </div>
        <input 
          type="text" 
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setFocusedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setFocusedIndex(prev => (prev > 0 ? prev - 1 : -1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (focusedIndex >= 0 && suggestions[focusedIndex]) {
                handleSelect(suggestions[focusedIndex]);
              }
            }
          }}
          className="flex-1 glass-input px-4 py-2.5 rounded-r-lg text-white placeholder:text-on-surface-variant/30 outline-none text-body-md transition-all duration-300 w-full"
        />
      </div>
      
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-surface-deep border border-white/10 rounded-lg overflow-y-auto max-h-[250px] shadow-2xl animate-slide-in">
          {suggestions.map((s, idx) => (
            <div 
              key={idx} 
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
              className={`px-4 py-3 border-white/5 cursor-pointer text-xs text-on-surface hover:bg-white/5 transition-colors flex items-center gap-2 ${idx < suggestions.length - 1 ? 'border-b' : ''} ${idx === focusedIndex ? 'bg-white/5' : ''}`}
              onMouseEnter={() => setFocusedIndex(idx)}
              onMouseLeave={() => setFocusedIndex(-1)}
            >
              {s.properties.isCustom ? (
                <span><span className="text-primary font-bold mr-1">[Internal]</span> {s.properties.name}, {s.properties.city}</span>
              ) : (
                <span>{s.properties.name ? s.properties.name + ', ' : ''}{s.properties.city ? s.properties.city + ', ' : ''}{s.properties.state || s.properties.country}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


const MapComponent = ({ pickupCoords, dropoffCoords, mapMode, setMapMode, onLocationSelect, routePolyline, liveDriverLocation }) => {
  const defaultPosition = [19.0760, 72.8777]; 

  let polylinePositions = [];
  if (routePolyline) {
    try {
      const coords = JSON.parse(routePolyline);
      // OSRM returns [lng, lat], Leaflet needs [lat, lng]
      polylinePositions = coords.map(c => [c[1], c[0]]);
    } catch (e) {
      console.error("Failed to parse polyline", e);
    }
  }

  return (
    <div className="glass-panel p-6 rounded-xl flex flex-col gap-4 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white">{setMapMode ? 'Live Route Planner' : 'Trip Map'}</h2>
        
        {setMapMode && (
          <div className="flex gap-2">
            <button 
              type="button"
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all duration-300 ${
                mapMode === 'pickup' 
                  ? 'bg-primary text-on-primary-container hover:shadow-[0_0_10px_rgba(2,150,118,0.3)]' 
                  : 'border border-white/10 hover:bg-white/5 text-white'
              }`}
              onClick={() => setMapMode('pickup')}
            >
              📍 Pick-up Pin
            </button>
            <button 
              type="button"
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all duration-300 ${
                mapMode === 'dropoff' 
                  ? 'bg-error-red text-white hover:shadow-[0_0_10px_rgba(229,57,53,0.3)]' 
                  : 'border border-white/10 hover:bg-white/5 text-white'
              }`}
              onClick={() => setMapMode('dropoff')}
            >
              📍 Drop-off Pin
            </button>
          </div>
        )}
      </div>
      
      {setMapMode && (
        <div className="text-xs text-on-surface-variant leading-relaxed">
          Click anywhere on the map to pinpoint your exact {mapMode === 'pickup' ? 'Pick-up' : 'Drop-off'} location. It will automatically update the form above.
        </div>
      )}
      
      <div className="flex-grow min-h-[400px] rounded-xl overflow-hidden border border-white/10 z-10 relative">
        <MapContainer center={defaultPosition} zoom={11} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          {onLocationSelect && <LocationSelector onLocationSelect={onLocationSelect} />}
          <MapBoundsUpdater pickup={pickupCoords} dropoff={dropoffCoords} />
          
          {pickupCoords && (
            <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={pickupIcon}>
              <Popup>Pick-up: {pickupCoords.name || 'Custom'}</Popup>
            </Marker>
          )}
          {dropoffCoords && (
            <Marker position={[dropoffCoords.lat, dropoffCoords.lng]} icon={dropoffIcon}>
              <Popup>Drop-off: {dropoffCoords.name || 'Custom'}</Popup>
            </Marker>
          )}
          
          {polylinePositions.length > 0 && (
            <Polyline positions={polylinePositions} color="#029676" weight={5} opacity={0.7} />
          )}
          
          {liveDriverLocation && (
            <Marker position={[liveDriverLocation.lat, liveDriverLocation.lng]} icon={carIcon}>
              <Popup>Host's Live Location</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {(pickupCoords || dropoffCoords) && (
        <div className="flex justify-between text-xs text-on-surface bg-primary/10 border border-primary/20 p-4 rounded-xl mt-2">
          <div><strong>Route Selection:</strong></div>
          <div>Pick-up: <span className="text-on-surface-variant">{pickupCoords ? pickupCoords.name : 'Not set'}</span></div>
          <div>Drop-off: <span className="text-on-surface-variant">{dropoffCoords ? dropoffCoords.name : 'Not set'}</span></div>
        </div>
      )}
    </div>
  );
};
export default MapComponent;
