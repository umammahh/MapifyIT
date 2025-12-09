const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();

// CORS configuration - allow frontend origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://mapify-it-task.vercel.app',
  // Add custom frontend URL from environment variable if provided
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
];

// Remove duplicates
const uniqueOrigins = [...new Set(allowedOrigins)];

// Helper function to check if origin is allowed
const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow requests with no origin
  
  // Check exact match
  if (uniqueOrigins.indexOf(origin) !== -1) {
    return true;
  }
  
  // Allow all Vercel preview URLs (they all end with .vercel.app)
  if (origin.endsWith('.vercel.app')) {
    return true;
  }
  
  // Allow all Netlify preview URLs
  if (origin.includes('.netlify.app')) {
    return true;
  }
  
  return false;
};

// CORS middleware function
const corsOptions = {
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      // In production, be strict; in development, allow all
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

// Additional CORS middleware for /data routes (static files)
app.use('/data', (req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow if origin is in allowed list, is a Vercel/Netlify URL, or in development
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
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Data path - now pointing to backend/data folder
const dataPath = path.join(__dirname, 'data');
console.log('Serving data from:', dataPath);
console.log('Absolute path:', path.resolve(dataPath));

app.use('/data', express.static(dataPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.geojson')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
  }
}));

// Explicit route handlers for GeoJSON files (fallback)
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

// Test endpoint to verify data directory is accessible
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

// API endpoint to fetch POIs for Islamabad
app.get('/api/pois', async (req, res) => {
  try {
    // Using Overpass API to fetch real POIs from OpenStreetMap
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"~"restaurant|cafe|hospital|school|bank|fuel"](33.65,73.0,33.75,73.15);
        node["tourism"~"attraction|museum|hotel"](33.65,73.0,33.75,73.15);
        node["shop"~"mall|supermarket"](33.65,73.0,33.75,73.15);
      );
      out body;
    `;

    const response = await axios.post('https://overpass-api.de/api/interpreter', overpassQuery, {
      headers: { 'Content-Type': 'text/plain' }
    });

    const pois = response.data.elements
      .filter(el => el.lat && el.lon)
      .map(el => ({
        name: el.tags?.name || el.tags?.amenity || el.tags?.tourism || 'Unnamed POI',
        coords: [el.lat, el.lon],
        type: el.tags?.amenity || el.tags?.tourism || el.tags?.shop || 'Other',
      }))
      .slice(0, 50); // Limit to 50 POIs

    res.json(pois);
  } catch (error) {
    console.error('Error fetching POIs:', error.message);
    // Return default POIs if Overpass API fails
    res.json([
      { name: "F-8 Markaz", coords: [33.6844, 73.0479], type: "Commercial" },
      { name: "F-10 Markaz", coords: [33.6900, 73.0450], type: "Commercial" },
      { name: "Centaurus Mall", coords: [33.7135, 73.0623], type: "Shopping" },
      { name: "Pakistan Monument", coords: [33.6934, 73.0678], type: "Landmark" },
      { name: "Faisal Mosque", coords: [33.7294, 73.0366], type: "Religious" },
    ]);
  }
});

// API endpoint to fetch roads for Islamabad
app.get('/api/roads', async (req, res) => {
  try {
    const overpassQuery = `
      [out:json][timeout:25];
      (
        way["highway"~"primary|secondary|tertiary"](33.65,73.0,33.75,73.15);
      );
      out geom;
    `;

    const response = await axios.post('https://overpass-api.de/api/interpreter', overpassQuery, {
      headers: { 'Content-Type': 'text/plain' }
    });

    // Islamabad bounding box: 33.60-33.75°N, 73.00-73.15°E
    const ISLAMABAD_BOUNDS = {
      minLat: 33.60,
      maxLat: 33.75,
      minLon: 73.00,
      maxLon: 73.15,
    };

    const roads = response.data.elements
      .filter(el => el.geometry && el.geometry.length > 0)
      .map(el => {
        // Filter coordinates to only include those within Islamabad bounds
        const validCoords = el.geometry
          .map(coord => [coord.lon, coord.lat])
          .filter(([lon, lat]) => 
            lat >= ISLAMABAD_BOUNDS.minLat && 
            lat <= ISLAMABAD_BOUNDS.maxLat &&
            lon >= ISLAMABAD_BOUNDS.minLon && 
            lon <= ISLAMABAD_BOUNDS.maxLon
          );
        
        // Only include roads with at least 2 valid coordinates
        if (validCoords.length < 2) return null;
        
        return {
          type: "Feature",
          properties: {
            name: el.tags?.name || 'Unnamed Road',
            type: el.tags?.highway || 'Road',
          },
          geometry: {
            type: "LineString",
            coordinates: validCoords,
          },
        };
      })
      .filter(road => road !== null); // Remove null entries

    res.json({ type: "FeatureCollection", features: roads });
  } catch (error) {
    console.error('Error fetching roads:', error.message);
    res.json({ type: "FeatureCollection", features: [] });
  }
});

// API endpoint to fetch administrative boundaries
app.get('/api/boundaries', async (req, res) => {
  try {
    const overpassQuery = `
      [out:json][timeout:25];
      (
        relation["admin_level"="4"]["name"="Islamabad"](33.65,73.0,33.75,73.15);
      );
      out geom;
    `;

    const response = await axios.post('https://overpass-api.de/api/interpreter', overpassQuery, {
      headers: { 'Content-Type': 'text/plain' }
    });

    // Process boundaries (simplified for demo)
    res.json({ type: "FeatureCollection", features: [] });
  } catch (error) {
    console.error('Error fetching boundaries:', error.message);
    res.json({ type: "FeatureCollection", features: [] });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
