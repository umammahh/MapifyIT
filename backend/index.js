const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const turf = require('@turf/turf');

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://mapify-it-task.vercel.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
];

const uniqueOrigins = [...new Set(allowedOrigins)];

const isOriginAllowed = (origin) => {
  if (!origin) return true; 
  
  if (uniqueOrigins.indexOf(origin) !== -1) {
    return true;
  }
  
  if (origin.endsWith('.vercel.app')) {
    return true;
  }
  
  if (origin.includes('.netlify.app')) {
    return true;
  }
  
  return false;
};

const corsOptions = {
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With']
};

app.use(cors(corsOptions));

app.use('/data', (req, res, next) => {
  const origin = req.headers.origin;
  
  if (isOriginAllowed(origin) || process.env.NODE_ENV !== 'production') {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

const dataPath = path.join(__dirname, 'data');
console.log('Serving data from:', dataPath);
console.log('Absolute path:', path.resolve(dataPath));

let enrichedPOIs = null;
let poiCollection = null;
let healthBuffers = null;
try {
  const enrichedPOIsPath = path.join(dataPath, 'enrichedPois.geojson');
  const rawPOIsPath = path.join(dataPath, 'rawPois.geojson');

  if (fs.existsSync(enrichedPOIsPath)) {
    enrichedPOIs = JSON.parse(fs.readFileSync(enrichedPOIsPath, 'utf8'));
    poiCollection = turf.featureCollection(enrichedPOIs.features);
    console.log(`Loaded ${enrichedPOIs.features.length} enriched POIs for geocoding (enrichedPois.geojson)`);
  } else if (fs.existsSync(rawPOIsPath)) {
    enrichedPOIs = JSON.parse(fs.readFileSync(rawPOIsPath, 'utf8'));
    poiCollection = turf.featureCollection(enrichedPOIs.features);
    console.warn('Fallback: enrichedPois.geojson not found, using rawPois.geojson for geocoding');
  } else {
    console.warn('No POI data found (enrichedPois.geojson or rawPois.geojson), geocoding endpoints will not work');
  }

  if (poiCollection?.features?.length) {
    const healthFeatures = poiCollection.features.filter(
      (f) => (f.properties?.category || '').toLowerCase() === 'health'
    );
    if (healthFeatures.length) {
      healthBuffers = turf.buffer(
        turf.featureCollection(healthFeatures),
        0.5, 
        { units: 'kilometers' }
      );
      console.log(`Computed health buffers for ${healthFeatures.length} health POIs (500m)`);
    } else {
      console.warn('No health POIs found to buffer');
    }
  }
} catch (error) {
  console.error('Error loading enriched POIs:', error.message);
}

app.use('/data', express.static(dataPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.geojson')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
  }
}));

app.get('/data/islamabad.geojson', (req, res) => {
  const filePath = path.join(dataPath, 'islamabad.geojson');
  console.log('Requested file:', filePath);
  console.log('File exists:', fs.existsSync(filePath));
  
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.sendFile(filePath);
  } else {
    console.error('File not found:', filePath);
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.status(404).json({ error: 'File not found', path: filePath });
  }
});

app.get('/data/rawPois.geojson', (req, res) => {
  const filePath = path.join(dataPath, 'rawPois.geojson');
  console.log('Requested file:', filePath);
  console.log('File exists:', fs.existsSync(filePath));
  
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.sendFile(filePath);
  } else {
    console.error('File not found:', filePath);
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.status(404).json({ error: 'File not found', path: filePath });
  }
});

app.get('/', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.json({ 
    status: 'ok', 
    message: 'MapifyIt backend',
    cors: 'enabled',
    allowedOrigins: uniqueOrigins
  });
});

app.get('/test-data', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  const testDataPath = path.join(__dirname, 'data');
  try {
    const files = fs.readdirSync(testDataPath);
    res.json({ 
      dataPath: testDataPath, 
      absolutePath: path.resolve(testDataPath),
      files,
      exists: fs.existsSync(testDataPath),
      islamabadExists: fs.existsSync(path.join(testDataPath, 'islamabad.geojson')),
      rawPoisExists: fs.existsSync(path.join(testDataPath, 'rawPois.geojson'))
    });
  } catch (error) {
    console.error('Test-data error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.get('/route', async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ 
        error: "start and end parameters required",
        example: "/route?start=33.6844,73.0479&end=33.7000,73.0500"
      });
    }

    const startCoords = start.split(",").map(coord => parseFloat(coord.trim()));
    const endCoords = end.split(",").map(coord => parseFloat(coord.trim()));

    if (startCoords.length !== 2 || endCoords.length !== 2 ||
        isNaN(startCoords[0]) || isNaN(startCoords[1]) ||
        isNaN(endCoords[0]) || isNaN(endCoords[1])) {
      return res.status(400).json({ 
        error: "Invalid coordinate format. Use: lat,lng (e.g., 33.6844,73.0479)"
      });
    }

    const [startLat, startLng] = startCoords;
    const [endLat, endLng] = endCoords;

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

    console.log('Fetching route from OSRM:', osrmUrl);
    
    const response = await axios.get(osrmUrl);

    if (!response.data.routes || response.data.routes.length === 0) {
      return res.status(404).json({ 
        error: "No route found between the specified points"
      });
    }

    const route = response.data.routes[0];
    const waypoints = response.data.waypoints || [];

    res.json({
      route: {
        distance: route.distance, 
        duration: route.duration, 
        geometry: route.geometry
      },
      waypoints: waypoints.map((wp, index) => ({
        name: index === 0 ? "Start Point" : index === waypoints.length - 1 ? "End Point" : `Waypoint ${index + 1}`,
        location: wp.location,
      }))
    });
  } catch (error) {
    console.error('Routing error:', error.message);
    
    if (error.response) {
      return res.status(error.response.status || 500).json({ 
        error: "Routing failed",
        details: error.response.data?.message || error.message
      });
    }
    
    res.status(500).json({ 
      error: "Routing failed",
      details: error.message
    });
  }
});

app.get('/api/geocoding/status', (req, res) => {
  res.json({
    status: 'ok',
    geocoding: 'enabled',
    poiDataLoaded: poiCollection !== null,
    poiCount: poiCollection ? poiCollection.features.length : 0,
    healthBuffers: !!healthBuffers
  });
});

app.get('/search', (req, res) => {
  try {
    const q = req.query.q;
    
    if (!q) {
      return res.status(400).json({ error: "Query parameter q is required" });
    }

    if (!poiCollection) {
      return res.status(503).json({ error: "POI data not loaded" });
    }

    const searchQuery = q.toLowerCase().trim();
    const results = poiCollection.features
      .filter(f => {
        const name = f.properties?.name || f.properties?.name_clean || '';
        return name.toLowerCase().includes(searchQuery);
      })
      .slice(0, 20) 
      .map(f => ({
        name: f.properties?.name || f.properties?.name_clean || 'Unnamed',
        category: f.properties?.category_group || f.properties?.amenity || 'N/A',
        coordinates: f.geometry.coordinates, 
      }));

    res.json({ results });
  } catch (error) {
    console.error('Search geocoding error:', error.message);
    res.status(500).json({ error: "Search failed", details: error.message });
  }
});

app.get('/reverse', (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng required" });
    }

    if (!poiCollection) {
      return res.status(503).json({ error: "POI data not loaded" });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({ error: "Invalid lat/lng format" });
    }

    const queryPoint = turf.point([lngNum, latNum]);

    let nearest = null;
    let minDist = Infinity;

    poiCollection.features.forEach(f => {
      const d = turf.distance(queryPoint, f, { units: 'kilometers' });
      if (d < minDist) {
        minDist = d;
        nearest = f;
      }
    });

    if (!nearest) {
      return res.status(404).json({ error: "No POI found" });
    }

    res.json({
      name: nearest.properties?.name || nearest.properties?.name_clean || 'Unnamed',
      category: nearest.properties?.category_group || nearest.properties?.amenity || 'N/A',
      coordinates: nearest.geometry.coordinates, 
      distance_km: parseFloat(minDist.toFixed(2)),
    });
  } catch (error) {
    console.error('Reverse geocoding error:', error.message);
    res.status(500).json({ error: "Reverse geocoding failed", details: error.message });
  }
});

app.get('/health-buffers', (req, res) => {
  try {
    if (healthBuffers) {
      res.json(healthBuffers);
    } else {
      res.status(503).json({ error: 'Health buffers not available' });
    }
  } catch (error) {
    console.error('Health buffers error:', error.message);
    res.status(500).json({ error: 'Health buffers failed', details: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
