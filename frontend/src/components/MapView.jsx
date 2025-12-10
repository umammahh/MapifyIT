import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, Circle, CircleMarker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.vectorgrid";
import SearchBar from "./SearchBar";

if (typeof window !== 'undefined') {
  window.L = L; 
}

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const ISB_BOUNDS = [
  [33.60, 73.00], 
  [33.75, 73.15], 
];
const ISB_LATLNG_BOUNDS = L.latLngBounds(ISB_BOUNDS);

const INLINE_BOUNDARY = {
  type: "FeatureCollection",
  features: [
    {
  type: "Feature",
      properties: { name: "Islamabad (fallback)" },
  geometry: {
    type: "Polygon",
        coordinates: [[
          [72.90, 33.55],
          [73.20, 33.55],
          [73.20, 33.80],
          [72.90, 33.80],
          [72.90, 33.55],
        ]],
      },
    },
  ],
};

const initialPOIs = [
  
];

const DATA_BASE =
  import.meta.env.VITE_DATA_BASE_URL || "http://localhost:5000/data"  || "https://mapify-it-task.onrender.com/data"
function MapboxVectorLayer() {
  const map = useMap();

  useEffect(() => {
    if (typeof L === 'undefined' || !L.vectorGrid || !L.vectorGrid.protobuf) {
      console.error("leaflet.vectorgrid is not loaded. Make sure it's imported.");
      return;
    }

    const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.MAPBOX_TOKEN;
    
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'undefined') {
      console.warn("MAPBOX_TOKEN not found. Vector tiles will not be displayed.");
      return;
    }

    const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${MAPBOX_TOKEN}`;

    const vectorLayer = L.vectorGrid.protobuf(url, {
      maxZoom: 20,
      minZoom: 0,
      interactive: false, 
      zIndex: 100,
      getFeatureId: (f) => f.properties?.id || f.properties?.osm_id || null,
      vectorTileLayerStyles: {
        road: { 
          weight: 1, 
          color: "gray",
          opacity: 0.7,
          fill: false
        },
        admin: { 
          weight: 2, 
          color: "blue", 
          fill: true, 
          fillColor: "lightblue",
          fillOpacity: 0.3,
          opacity: 0.8
        },
        water: { 
          fill: true, 
          fillColor: "#a8d5e2", 
          fillOpacity: 0.6, 
          stroke: false 
        },
        landuse: { 
          fill: true, 
          fillColor: "#f0f0f0", 
          fillOpacity: 0.4, 
          stroke: false 
        },
        park: { 
          fill: true, 
          fillColor: "#c8e6c9", 
          fillOpacity: 0.5, 
          stroke: true,
          color: "#81c784",
          weight: 1,
          opacity: 0.6
        },
        transportation: { 
          color: "brown", 
          weight: 1, 
          opacity: 0.7,
          fill: false
        },
        building: { 
          fill: true, 
          fillColor: "#d0d0d0", 
          fillOpacity: 0.6, 
          color: "#999999", 
          weight: 0.5 
        },
        boundary: { 
          color: "blue", 
          weight: 2, 
          opacity: 0.8,
          fill: true,
          fillColor: "lightblue",
          fillOpacity: 0.3
        },
        place: {
          fill: false,
          stroke: false
        },
        _default: { 
          color: "#888888", 
          weight: 1, 
          opacity: 0.5, 
          fill: false 
        },
      },
    })
    .on("click", (e) => {
      const props = e.layer?.properties || {};
      const name = props.name || props.amenity || "Feature";
      L.popup()
        .setLatLng(e.latlng)
        .setContent(`<b>${name}</b>`)
        .openOn(map);
    });

    const isWithinIslamabad = () => {
      const mapBounds = map.getBounds();
      const center = map.getCenter();
      
      const centerInBounds = 
        center.lat >= ISB_BOUNDS[0][0] && 
        center.lat <= ISB_BOUNDS[1][0] &&
        center.lng >= ISB_BOUNDS[0][1] && 
        center.lng <= ISB_BOUNDS[1][1];
      
      const boundsIntersect = mapBounds.intersects(ISB_LATLNG_BOUNDS);
      
      return centerInBounds || (boundsIntersect && map.getZoom() >= 11);
    };

    let layerAdded = false;

    const updateVectorTileVisibility = () => {
      const shouldShow = isWithinIslamabad();
      
      if (shouldShow) {
        if (!layerAdded) {
          vectorLayer._shouldLoadTile = undefined;
          vectorLayer.addTo(map);
          layerAdded = true;
          console.log("Vector tiles enabled (Islamabad region visible)");
        }
      } else {
        if (layerAdded) {
          vectorLayer._shouldLoadTile = () => false;
          
          if (vectorLayer._tiles) {
            Object.keys(vectorLayer._tiles).forEach(key => {
              const tile = vectorLayer._tiles[key];
              if (tile) {
                if (tile.remove) tile.remove();
                if (tile._container && tile._container.remove) {
                  tile._container.remove();
                }
              }
            });
            vectorLayer._tiles = {};
          }
          
          map.removeLayer(vectorLayer);
          layerAdded = false;
          
          const container = map.getContainer();
          const vectorContainers = container.querySelectorAll('.leaflet-vectorgrid-tile-container');
          vectorContainers.forEach(el => el.remove());
          
          map.invalidateSize();
          console.log("Vector tiles disabled (outside Islamabad region)");
        }
      }
    };

    map.on("moveend zoomend load", updateVectorTileVisibility);
    
    map.on("move", updateVectorTileVisibility);
    
    updateVectorTileVisibility();

    return () => {
      map.off("moveend zoomend load move", updateVectorTileVisibility);
      if (map.hasLayer(vectorLayer)) {
        map.removeLayer(vectorLayer);
      }
    };
  }, [map]);

  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      console.log('[MapClickHandler] map click', { lat, lng });
      onMapClick(lat, lng);
    },
  });

  return null;
}

export default function MapView() {
  const [pois, setPois] = useState(initialPOIs);
  const [loading, setLoading] = useState(false);
  const [boundary, setBoundary] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const mapRef = useRef(null);
  const reverseInFlightRef = useRef(false);
  const [healthBuffers, setHealthBuffers] = useState(null);
  const [routeGeo, setRouteGeo] = useState(null);
  const [routeError, setRouteError] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [clickAssignTarget, setClickAssignTarget] = useState(null); // 'start' | 'end' | null

  const API_BASE = useMemo(() =>
    import.meta.env.VITE_DATA_BASE_URL?.replace('/data', '') ||  "http://localhost:5000"  || "https://mapify-it-task.onrender.com",
[]
  );

  useEffect(() => {
    const loadBoundary = async () => {
      try {
        const url = `${DATA_BASE}/islamabad.geojson`;
        console.log('Loading boundary from:', url);
        let res = await fetch(url);
        
        if (!res.ok) {
          console.warn(`Failed to load from ${url}, status: ${res.status}`);
          res = await fetch("/data/islamabad.geojson");
        }
        
        if (res.ok) {
          const geo = await res.json();
          console.log('Loaded boundary with', geo.features?.length || 0, 'features');
          setBoundary(geo);
          return;
        }
        
        console.warn("Could not load Islamabad boundary from any source, using fallback");
        setBoundary(INLINE_BOUNDARY);
      } catch (e) {
        console.error("Error loading Islamabad boundary:", e);
        setBoundary(INLINE_BOUNDARY);
      }
    };
    loadBoundary();
  }, []);

  useEffect(() => {
    if (!boundary || !boundary.features?.length) return;
    try {
      const bounds = L.geoJSON(boundary).getBounds();
      if (bounds.isValid()) {
        setTimeout(() => {
          const map = window.leafletMapInstance;
          if (map) map.fitBounds(bounds, { padding: [20, 20] });
        }, 50);
      }
    } catch (e) {
      console.warn("Could not fit to boundary", e);
    }
  }, [boundary]);

  useEffect(() => {
    const fetchPOIs = async () => {
      try {
        setLoading(true);
        const enrichedUrl = `${DATA_BASE}/enrichedPois.geojson`;
        const rawUrl = `${DATA_BASE}/rawPois.geojson`;

        console.log('Loading POIs (enriched) from:', enrichedUrl);
        let localRes = await fetch(enrichedUrl);
        
        if (!localRes.ok) {
          console.warn(`Failed to load enriched from ${enrichedUrl}, status: ${localRes.status}`);
          console.log('Trying raw POIs from:', rawUrl);
          localRes = await fetch(rawUrl);
        }
        
        if (localRes.ok) {
          const geo = await localRes.json();
          console.log('Loaded POI GeoJSON with', geo.features?.length || 0, 'features');
          const parsed = (geo.features || [])
            .map((f) => {
              const [lon, lat] = f.geometry?.coordinates || [];
              return {
                name: f.properties?.clean_name || f.properties?.name || f.properties?.amenity || "POI",
                coords: [lat, lon],
                type: f.properties?.category || f.properties?.category_group || f.properties?.amenity || "POI",
              };
            })
            .filter((p) => p.coords[0] && p.coords[1])
            .filter((p) =>
              p.coords[0] >= ISB_BOUNDS[0][0] &&
              p.coords[0] <= ISB_BOUNDS[1][0] &&
              p.coords[1] >= ISB_BOUNDS[0][1] &&
              p.coords[1] <= ISB_BOUNDS[1][1]
            );
          console.log('Parsed', parsed.length, 'POIs within Islamabad bounds');
          setPois(parsed.length ? parsed.slice(0, 8000) : initialPOIs);
          return;
        }
        
        console.warn("Could not load rawPois.geojson from any source, using default POIs");
        setPois(initialPOIs);
      } catch (error) {
        console.error("Error loading POIs:", error);
        setPois(initialPOIs);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPOIs();
  }, []);

  useEffect(() => {
    const fetchHealthBuffers = async () => {
      try {
        const url = `${API_BASE}/health-buffers`;
        console.log('Loading health buffers from:', url);
        const res = await fetch(url);
        if (res.ok) {
          const geo = await res.json();
          console.log('Loaded health buffers with', geo.features?.length || 0, 'features');
          setHealthBuffers(geo);
        } else {
          console.warn('Failed to load health buffers, status:', res.status);
        }
      } catch (error) {
        console.error('Error loading health buffers:', error);
      }
    };
    fetchHealthBuffers();
  }, [API_BASE]);

  const flyTo = useCallback((coords, zoom = 15, duration = 1.2) => {
    const map = mapRef.current || window.leafletMapInstance;
    if (map && map.flyTo) {
      map.flyTo(coords, zoom, { animate: true, duration });
    } else {
      console.warn('Map not ready for flyTo; retrying shortly');
      setTimeout(() => {
        const retryMap = mapRef.current || window.leafletMapInstance;
        if (retryMap && retryMap.flyTo) {
          retryMap.flyTo(coords, zoom, { animate: true, duration });
        }
      }, 150);
    }
  }, []);

  const handleLocationSelect = useCallback((coords, result) => {
    console.log('[SearchSelect] location chosen', { coords, result });
    setSelectedLocation({ coords, result, source: 'search' });
    flyTo(coords, 17, 1.5); 
  }, [flyTo]);

  const handleReverseResult = useCallback((coords, result) => {
    console.log('[ReverseResult] nearest POI', { coords, result });
    setSelectedLocation({ 
      coords, 
      result: {
        name: result.name,
        category: result.category,
        distance_km: result.distance_km
      },
      source: 'click'
    });
    flyTo(coords, 16, 1.0);
  }, [flyTo]);

  const triggerReverseGeocode = useCallback(async (lat, lng) => {
    if (reverseInFlightRef.current) {
      console.log('[Reverse] already in flight, skipping');
      return;
    }

    reverseInFlightRef.current = true;
    console.log('[Reverse] start', { lat, lng, api: `${API_BASE}/reverse` });

    try {
      const response = await fetch(`${API_BASE}/reverse?lat=${lat}&lng=${lng}`);
      console.log('[Reverse] status', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[Reverse] data', data);
        handleReverseResult([lat, lng], data);

        // If user chose to assign pin to start/end, populate the fields
        if (clickAssignTarget === 'start') {
          setStartInput(`${lat.toFixed(6)},${lng.toFixed(6)}`);
          setClickAssignTarget('end'); // auto-switch to end for next click
        } else if (clickAssignTarget === 'end') {
          setEndInput(`${lat.toFixed(6)},${lng.toFixed(6)}`);
          setClickAssignTarget(null); // done assigning
        }
      } else {
        console.warn('[Reverse] failed status', response.status);
      }
    } catch (error) {
      console.error('[Reverse] error', error);
    } finally {
      reverseInFlightRef.current = false;
    }
  }, [API_BASE, handleReverseResult, clickAssignTarget]);

  // Parse "lat,lng" string
  const parseLatLng = (value) => {
    if (!value) return null;
    const parts = value.split(",").map((p) => parseFloat(p.trim()));
    if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return null;
    return parts;
  };

  // Fetch route from backend
  const fetchRoute = useCallback(async (startStr, endStr) => {
    const start = parseLatLng(startStr);
    const end = parseLatLng(endStr);

    if (!start || !end) {
      setRouteError("Enter start/end as lat,lng (e.g., 33.6844,73.0479)");
      return;
    }

    setRouteLoading(true);
    setRouteError("");
    setRouteGeo(null);

    try {
      const url = `${API_BASE}/route?start=${start[0]},${start[1]}&end=${end[0]},${end[1]}`;
      console.log("[Route] fetching", url);
      const res = await fetch(url);
      if (!res.ok) {
        setRouteError(`Route failed (status ${res.status})`);
        return;
      }
      const data = await res.json();
      if (!data?.route?.geometry) {
        setRouteError("No route geometry returned");
        return;
      }

      const feature = {
        type: "Feature",
        geometry: data.route.geometry,
        properties: {
          distance_m: data.route.distance,
          duration_s: data.route.duration,
        },
      };
      setRouteGeo({ type: "FeatureCollection", features: [feature] });

      // Fly to start/end midpoint
      const midLat = (start[0] + end[0]) / 2;
      const midLng = (start[1] + end[1]) / 2;
      flyTo([midLat, midLng], 13, 1.2);
    } catch (error) {
      console.error("[Route] error", error);
      setRouteError("Route request failed");
    } finally {
      setRouteLoading(false);
    }
  }, [API_BASE, flyTo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handler = (e) => {
      const { lat, lng } = e.latlng;
      console.log('[MapInstance] click', { lat, lng });
      triggerReverseGeocode(lat, lng);
    };

    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [triggerReverseGeocode]);

  const boundaryStyle = {
    color: "#2563eb",
    weight: 2,
    opacity: 0.8,
    fillOpacity: 0.05,
  };

  const getPOIIcon = useCallback((type) => {
    const colors = {
      Education: "#1E90FF",
      Health: "#E63946",
      Commercial: "#FF8C00",
      Religious: "#6A4C93",
      Recreation: "#2ECC71",
      Transport: "#34495E",
      Government: "#F1C40F",
      Food: "#FF4D6D",
      Unknown: "#95A5A6",
    };

    const normalized = (type || "").toString().trim();
    const color =
      colors[normalized] ||
      colors[normalized.toLowerCase()?.replace(/\b\w/g, (c) => c.toUpperCase())] ||
      colors.Unknown;

    return L.divIcon({
      className: "custom-poi-icon",
      // very small dot, no border/shadow
      html: `<div style="background-color: ${color}; width: 8px; height: 8px; border-radius: 50%;"></div>`,
      iconSize: [6, 6],
      iconAnchor: [3, 3],
    });
  }, []);

  // Style for health buffers
  const healthBufferStyle = useCallback(() => ({
    color: "#0B3D2E",      // dark green outline
    fillColor: "#0B3D2E",
    fillOpacity: 0.18,
    weight: 1,
    dashArray: "3,3"
  }), []);

  // Style for route line
  const routeStyle = useCallback(() => ({
    color: "#0ea5e9", // sky-500
    weight: 5,
    opacity: 0.9
  }), []);
  
  // Memoize highlight circles to avoid recreating on every render
  const highlightCircles = useMemo(() => {
    if (!selectedLocation) return null;
    
    return (
      <>
        {/* Highlight Circle - larger area indicator */}
        <Circle
          interactive={false}
          center={selectedLocation.coords}
          radius={500}
          pathOptions={{
            color: "#ef4444",
            fillColor: "#ef4444",
            fillOpacity: 0.2,
            weight: 3,
            opacity: 0.6
          }}
        />
        
        <Circle
          interactive={false}
          center={selectedLocation.coords}
          radius={200}
          pathOptions={{
            color: "#ef4444",
            fillColor: "#ef4444",
            fillOpacity: 0.3,
            weight: 2,
            opacity: 0.8
          }}
        />
        
        <CircleMarker
          center={selectedLocation.coords}
          radius={12}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#ef4444",
            fillOpacity: 1,
            weight: 3
          }}
        >
          <Popup>
            <div>
              <b>{selectedLocation.result.name}</b>
              <br />
              Category: {selectedLocation.result.category}
              <br />
              {selectedLocation.result.distance_km && (
                <>
                  Distance: {selectedLocation.result.distance_km.toFixed(2)} km
                  <br />
                </>
              )}
              Coordinates: {selectedLocation.coords[0].toFixed(4)}, {selectedLocation.coords[1].toFixed(4)}
            </div>
          </Popup>
        </CircleMarker>
        
        <CircleMarker
          interactive={false}
          center={selectedLocation.coords}
          radius={25}
          pathOptions={{
            color: "#ef4444",
            fillColor: "transparent",
            fillOpacity: 0,
            weight: 2,
            opacity: 0.4,
            dashArray: "10, 10"
          }}
          className="selected-location-highlight"
        />
        
        <Circle
          interactive={false}
          center={selectedLocation.coords}
          radius={300}
          pathOptions={{
            color: "#ef4444",
            fillColor: "transparent",
            fillOpacity: 0,
            weight: 2,
            opacity: 0.3,
            dashArray: "5, 5"
          }}
          className="selected-location-highlight"
        />
      </>
    );
  }, [selectedLocation]);

  return (
    <div style={{ position: "relative", height: "90vh", width: "100%" }}>
      {selectedLocation && (
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "12px",
            zIndex: 1200,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "10px 12px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            pointerEvents: "none",
            maxWidth: "260px",
            fontSize: "14px",
            color: "#111827",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "4px", color: "#111827" }}>
            {selectedLocation.result?.name || "Selected location"}
          </div>
          <div style={{ color: "#4b5563", marginBottom: "2px" }}>
            {selectedLocation.result?.category || "N/A"}
          </div>
          {selectedLocation.result?.distance_km !== undefined && (
            <div style={{ color: "#6b7280", marginBottom: "2px" }}>
              Distance: {selectedLocation.result.distance_km.toFixed(2)} km
            </div>
          )}
          <div style={{ color: "#6b7280" }}>
            {selectedLocation.coords[0].toFixed(4)}, {selectedLocation.coords[1].toFixed(4)}
          </div>
          <div style={{ color: "#2563eb", marginTop: "4px", fontWeight: 600 }}>
            {selectedLocation.source === "click" ? "Reverse geocoded" : "Search result"}
          </div>
        </div>
      )}

      {/* Routing panel */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          zIndex: 1200,
          background: "rgba(255,255,255,0.95)",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "10px 12px",
          boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
          width: "260px",
          fontSize: "14px",
          color: "#111827",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: "8px" }}>Route (OSRM)</div>

        <label style={{ display: "block", marginBottom: "6px", color: "#374151", fontWeight: 600 }}>Start (lat,lng)</label>
        <input
          type="text"
          value={startInput}
          onChange={(e) => setStartInput(e.target.value)}
          placeholder="33.6844,73.0479"
          style={{
            width: "100%",
            padding: "8px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            marginBottom: "8px",
            fontSize: "13px"
          }}
        />

        <label style={{ display: "block", marginBottom: "6px", color: "#374151", fontWeight: 600 }}>End (lat,lng)</label>
        <input
          type="text"
          value={endInput}
          onChange={(e) => setEndInput(e.target.value)}
          placeholder="33.7000,73.0500"
          style={{
            width: "100%",
            padding: "8px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            marginBottom: "8px",
            fontSize: "13px"
          }}
        />

        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <button
            onClick={() => setClickAssignTarget('start')}
            style={{
              flex: 1,
              padding: "8px",
              background: clickAssignTarget === 'start' ? "#1d4ed8" : "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            Set Start by Pin
          </button>
          <button
            onClick={() => setClickAssignTarget('end')}
            style={{
              flex: 1,
              padding: "8px",
              background: clickAssignTarget === 'end' ? "#047857" : "#10b981",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            Set End by Pin
          </button>
        </div>

        <button
          onClick={() => fetchRoute(startInput, endInput)}
          disabled={routeLoading}
          style={{
            width: "100%",
            padding: "10px",
            background: "#0ea5e9",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "14px",
            opacity: routeLoading ? 0.7 : 1
          }}
        >
          {routeLoading ? "Routing..." : "Get Route"}
        </button>

        {routeError && (
          <div style={{ color: "#e11d48", marginTop: "6px", fontSize: "12px" }}>
            {routeError}
          </div>
        )}
      </div>

      <SearchBar 
        onSelectLocation={handleLocationSelect}
        map={window.leafletMapInstance}
      />
      
    <MapContainer
      center={[33.6844, 73.0479]}
      zoom={13}
      minZoom={10}
      maxZoom={19}
        style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
        eventHandlers={{
          click: (e) => {
            const { lat, lng } = e.latlng;
            console.log('[MapContainer] click', { lat, lng });
            triggerReverseGeocode(lat, lng);
          }
        }}
      whenCreated={(map) => {
        window.leafletMapInstance = map;
          mapRef.current = map;
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        opacity={0.7}
        zIndex={0}
      />

      <MapboxVectorLayer />

      <MapClickHandler onMapClick={triggerReverseGeocode} />

      {boundary && (
        <GeoJSON
          data={boundary}
          style={boundaryStyle}
          interactive={false} 
        />
      )}

      {healthBuffers && (
        <GeoJSON
          data={healthBuffers}
          style={healthBufferStyle}
          interactive={false}
        />
      )}

      {routeGeo && (
        <GeoJSON
          data={routeGeo}
          style={routeStyle}
          interactive={false}
        />
      )}

      {pois.map((poi, idx) => (
        <Marker key={idx} position={poi.coords} icon={getPOIIcon(poi.type)}>
          <Popup>
            <div>
              <b>{poi.name}</b>
              <br />
              Type: {poi.type}
              <br />
              Coordinates: {poi.coords[0].toFixed(4)}, {poi.coords[1].toFixed(4)}
            </div>
          </Popup>
        </Marker>
      ))}

      {highlightCircles}
    </MapContainer>
    </div>
  );
}
