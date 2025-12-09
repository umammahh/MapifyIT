import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
// Import leaflet.vectorgrid - this extends L.vectorGrid
import "leaflet.vectorgrid";

// Verify vectorgrid is loaded
if (typeof window !== 'undefined') {
  window.L = L; // Make sure L is global for vectorgrid
}

// Fix Leaflet marker icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Islamabad bounding box (used for filtering data; map is not hard-clamped)
const ISB_BOUNDS = [
  [33.60, 73.00], // South-West
  [33.75, 73.15], // North-East
];
const ISB_LATLNG_BOUNDS = L.latLngBounds(ISB_BOUNDS);

// Inline fallback boundary (in case remote fetch fails)
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

// Fallback POIs (minimal) if remote fetch fails
const initialPOIs = [
  { name: "F-8 Markaz", coords: [33.6844, 73.0479], type: "Commercial" },
  { name: "Centaurus Mall", coords: [33.7135, 73.0623], type: "Shopping" },
];

// Data base URL (backend static /data). Default to localhost:5000.
const DATA_BASE =
  import.meta.env.VITE_DATA_BASE_URL ||
  "http://localhost:5000/data";

// Mapbox Vector Tiles layer - Only visible when map view intersects Islamabad bounds
function MapboxVectorLayer() {
  const map = useMap();

  useEffect(() => {
    // Check if leaflet.vectorgrid is available
    if (typeof L === 'undefined' || !L.vectorGrid || !L.vectorGrid.protobuf) {
      console.error("leaflet.vectorgrid is not loaded. Make sure it's imported.");
      return;
    }

    const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.MAPBOX_TOKEN;
    
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'undefined') {
      console.warn("MAPBOX_TOKEN not found. Vector tiles will not be displayed.");
      return;
    }

    // Create vector tile layer with comprehensive styling
    // Only load tiles that intersect with Islamabad bounds
    const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${MAPBOX_TOKEN}`;

    const vectorLayer = L.vectorGrid.protobuf(url, {
      maxZoom: 20,
      minZoom: 0,
      interactive: true,
      zIndex: 100, // Above base OSM tiles, below POIs/boundaries
      getFeatureId: (f) => f.properties?.id || f.properties?.osm_id || null,
      vectorTileLayerStyles: {
        // Roads - gray lines
        road: { 
          weight: 1, 
          color: "gray",
          opacity: 0.7,
          fill: false
        },
        // Administrative boundaries - blue lines with light blue fill
        admin: { 
          weight: 2, 
          color: "blue", 
          fill: true, 
          fillColor: "lightblue",
          fillOpacity: 0.3,
          opacity: 0.8
        },
        // Water bodies
        water: { 
          fill: true, 
          fillColor: "#a8d5e2", 
          fillOpacity: 0.6, 
          stroke: false 
        },
        // Land use areas
        landuse: { 
          fill: true, 
          fillColor: "#f0f0f0", 
          fillOpacity: 0.4, 
          stroke: false 
        },
        // Parks and green spaces
        park: { 
          fill: true, 
          fillColor: "#c8e6c9", 
          fillOpacity: 0.5, 
          stroke: true,
          color: "#81c784",
          weight: 1,
          opacity: 0.6
        },
        // Transportation (fallback for road variations)
        transportation: { 
          color: "gray", 
          weight: 1, 
          opacity: 0.7,
          fill: false
        },
        // Buildings
        building: { 
          fill: true, 
          fillColor: "#d0d0d0", 
          fillOpacity: 0.6, 
          color: "#999999", 
          weight: 0.5 
        },
        // Boundary (fallback for admin)
        boundary: { 
          color: "blue", 
          weight: 2, 
          opacity: 0.8,
          fill: true,
          fillColor: "lightblue",
          fillOpacity: 0.3
        },
        // Places (labels background)
        place: {
          fill: false,
          stroke: false
        },
        // Default style for any other layers
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

    // Function to check if map view is within or significantly overlaps Islamabad bounds
    const isWithinIslamabad = () => {
      const mapBounds = map.getBounds();
      const center = map.getCenter();
      
      // Check if center is within Islamabad bounds
      const centerInBounds = 
        center.lat >= ISB_BOUNDS[0][0] && 
        center.lat <= ISB_BOUNDS[1][0] &&
        center.lng >= ISB_BOUNDS[0][1] && 
        center.lng <= ISB_BOUNDS[1][1];
      
      // Also check if bounds intersect (for when zoomed out)
      const boundsIntersect = mapBounds.intersects(ISB_LATLNG_BOUNDS);
      
      // Only show if center is in bounds OR if significantly overlapping
      return centerInBounds || (boundsIntersect && map.getZoom() >= 11);
    };

    // Track if layer is added
    let layerAdded = false;

    // Function to update vector tile visibility
    const updateVectorTileVisibility = () => {
      const shouldShow = isWithinIslamabad();
      
      if (shouldShow) {
        // Map view is within Islamabad - show vector tiles
        if (!layerAdded) {
          // Re-enable tile loading
          vectorLayer._shouldLoadTile = undefined;
          vectorLayer.addTo(map);
          layerAdded = true;
          console.log("Vector tiles enabled (Islamabad region visible)");
        }
      } else {
        // Map view outside Islamabad - completely remove vector tiles
        if (layerAdded) {
          // Stop loading new tiles
          vectorLayer._shouldLoadTile = () => false;
          
          // Remove all tiles
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
          
          // Remove layer from map
          map.removeLayer(vectorLayer);
          layerAdded = false;
          
          // Clear any vector tile containers from DOM
          const container = map.getContainer();
          const vectorContainers = container.querySelectorAll('.leaflet-vectorgrid-tile-container');
          vectorContainers.forEach(el => el.remove());
          
          // Force map redraw to clear any remaining tiles
          map.invalidateSize();
          console.log("Vector tiles disabled (outside Islamabad region)");
        }
      }
    };

    // Check on map move/zoom (use moveend for performance, but also check during move)
    map.on("moveend zoomend load", updateVectorTileVisibility);
    
    // Also check during move for more responsive updates
    map.on("move", updateVectorTileVisibility);
    
    // Initial check
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

export default function MapView() {
  const [pois, setPois] = useState(initialPOIs);
  const [loading, setLoading] = useState(false);
  const [boundary, setBoundary] = useState(null);

  // Fetch boundary (islamabad.geojson) from backend static /data
  useEffect(() => {
    const loadBoundary = async () => {
      try {
        // Try backend-served data first
        const url = `${DATA_BASE}/islamabad.geojson`;
        console.log('Loading boundary from:', url);
        let res = await fetch(url);
        
        if (!res.ok) {
          console.warn(`Failed to load from ${url}, status: ${res.status}`);
          // Try relative (if served from public/)
          res = await fetch("/data/islamabad.geojson");
        }
        
        if (res.ok) {
          const geo = await res.json();
          console.log('Loaded boundary with', geo.features?.length || 0, 'features');
          setBoundary(geo);
          return;
        }
        
        // Fallback to inline boundary
        console.warn("Could not load Islamabad boundary from any source, using fallback");
        setBoundary(INLINE_BOUNDARY);
      } catch (e) {
        console.error("Error loading Islamabad boundary:", e);
        setBoundary(INLINE_BOUNDARY);
      }
    };
    loadBoundary();
  }, []);

  // Fit map to boundary once loaded
  useEffect(() => {
    if (!boundary || !boundary.features?.length) return;
    try {
      const bounds = L.geoJSON(boundary).getBounds();
      if (bounds.isValid()) {
        // Use a small timeout to ensure map is ready
        setTimeout(() => {
          const map = window.leafletMapInstance;
          if (map) map.fitBounds(bounds, { padding: [20, 20] });
        }, 50);
      }
    } catch (e) {
      console.warn("Could not fit to boundary", e);
    }
  }, [boundary]);

  // Fetch POIs from rawPois.geojson in /data (no Overpass/API fallback)
  useEffect(() => {
    const fetchPOIs = async () => {
      try {
        setLoading(true);
        // Try local GeoJSON first
        const url = `${DATA_BASE}/rawPois.geojson`;
        console.log('Loading POIs from:', url);
        let localRes = await fetch(url);
        
        if (!localRes.ok) {
          console.warn(`Failed to load from ${url}, status: ${localRes.status}`);
          localRes = await fetch("/data/rawPois.geojson");
        }
        
        if (localRes.ok) {
          const geo = await localRes.json();
          console.log('Loaded POI GeoJSON with', geo.features?.length || 0, 'features');
          const parsed = (geo.features || [])
            .map((f) => {
              const [lon, lat] = f.geometry?.coordinates || [];
              return {
                name: f.properties?.name || f.properties?.amenity || "POI",
                coords: [lat, lon],
                type: f.properties?.amenity || f.properties?.category_group || "POI",
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
        
        // Fallback to minimal POIs
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

  // Style functions
  const boundaryStyle = {
    color: "#2563eb",
    weight: 2,
    opacity: 0.8,
    fillOpacity: 0.05,
  };

  const getPOIIcon = (type) => {
    const colors = {
      Commercial: "#3b82f6",
      Shopping: "#8b5cf6",
      Landmark: "#ef4444",
      Religious: "#10b981",
      Transport: "#f59e0b",
      Park: "#22c55e",
      Cultural: "#ec4899",
    };
    return L.divIcon({
      className: "custom-poi-icon",
      html: `<div style="background-color: ${colors[type] || "#6b7280"}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
  };

  return (
    <MapContainer
      center={[33.6844, 73.0479]}
      zoom={13}
      minZoom={10}
      maxZoom={19}
      style={{ height: "90vh", width: "100%" }}
      scrollWheelZoom={true}
      whenCreated={(map) => {
        // expose for fitBounds after boundary loads
        window.leafletMapInstance = map;
      }}
    >
      {/* Base OSM raster tiles - background layer */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        opacity={0.7}
        zIndex={0}
      />

      {/* Mapbox Vector Tiles - Overlay on top of base map */}
      <MapboxVectorLayer />

      {/* Islamabad Boundary */}
      {boundary && (
        <GeoJSON
          data={boundary}
          style={boundaryStyle}
          onEachFeature={(feature, layer) => {
            const name = feature.properties?.name || "Islamabad Region";
            layer.bindPopup(`<b>${name}</b>`);
          }}
        />
      )}

      {/* POI Markers */}
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
    </MapContainer>
  );
}
