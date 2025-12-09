# MapifyIt Developer Test — Part 1: Map Deployment

## Part 1 Deliverables

### Map URL
**Local Development:** `http://localhost:5173` (after running `npm run dev` in frontend/)
**Production:** Deploy to Vercel/Netlify (see Deployment section below)

### Workflow Explanation

#### 1. **Vector Tiles Implementation**
- **Technology:** MapTiler vector tiles (free tier available)
- **Implementation:** Using MapTiler's OpenStreetMap style which provides vector-based rendering
- **Location:** `frontend/src/components/MapView.jsx` - `VectorTileLayer` component
- **Why Vector Tiles:** Vector tiles provide better performance, scalability, and styling flexibility compared to raster tiles. They allow for dynamic styling and smooth zooming.

#### 2. **Data Sources**
- **Base Map:** MapTiler vector tiles (OSM-based)
- **Roads:** 
  - Static GeoJSON data for major roads (Jinnah Avenue, 7th Avenue, Faisal Avenue)
  - Backend API endpoint `/api/roads` fetches real-time road data from OSM Overpass API
- **POIs (Points of Interest):**
  - Initial set of 8 key POIs (F-8 Markaz, Centaurus Mall, Faisal Mosque, etc.)
  - Backend API endpoint `/api/pois` fetches additional POIs from OSM Overpass API
  - POIs are categorized (Commercial, Shopping, Landmark, Religious, Transport, Park, Cultural)
- **Administrative Boundaries:**
  - GeoJSON polygons for Islamabad F-Sectors (F-6, F-7, F-8, F-10)
  - Styled with blue borders and semi-transparent fill

#### 3. **Tech Stack**
- **Frontend:** React 19 + Vite + Leaflet + React-Leaflet
- **Backend:** Express.js + Axios (for OSM Overpass API queries)
- **Map Library:** Leaflet with React-Leaflet bindings
- **Vector Tiles:** MapTiler (free tier)

#### 4. **Features Implemented**
✅ Vector tiles for Islamabad region  
✅ Roads layer (primary and secondary roads)  
✅ POIs with categorized markers and popups  
✅ Administrative boundaries (Islamabad sectors)  
✅ Interactive popups with feature information  
✅ Responsive design  

#### 5. **Data Flow**
```
User Browser
    ↓
React Frontend (MapView.jsx)
    ↓
MapTiler Vector Tiles (Base Map)
    ↓
GeoJSON Layers (Roads, Boundaries, POIs)
    ↓
Backend API (Optional - fetches real-time OSM data)
    ↓
OSM Overpass API (for dynamic POIs and roads)
```

## Project Structure
- `frontend/` - React + Leaflet application
  - `src/components/MapView.jsx` - Main map component with all layers
  - `src/App.jsx` - Root component
- `backend/` - Express.js API server
  - `index.js` - API endpoints for POIs, roads, boundaries
- `data/` - Raw and enriched datasets (for future use)
- `docs/` - Documentation

## Local Development

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### Setup

1. **Install Frontend Dependencies:**
```bash
cd frontend
npm install
```

2. **Install Backend Dependencies:**
```bash
cd backend
npm install
```

3. **Optional: Get MapTiler API Key**
   - Visit https://www.maptiler.com/cloud/
   - Sign up for free account
   - Get your API key
   - Create `frontend/.env` file:
     ```
     VITE_MAPTILER_KEY=your_key_here
     ```

4. **Run Backend:**
```bash
cd backend
npm start
```
Backend runs on `http://localhost:5000`

5. **Run Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on `http://localhost:5173`

## Deployment

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI:**
```bash
npm i -g vercel
```

2. **Deploy Frontend:**
```bash
cd frontend
vercel
```

3. **Set Environment Variables in Vercel Dashboard:**
   - `VITE_MAPTILER_KEY` - Your MapTiler API key

4. **Deploy Backend (separate service):**
   - Use Railway, Render, or Heroku for backend
   - Update `VITE_API_URL` in frontend environment variables

### Option 2: Netlify

1. **Install Netlify CLI:**
```bash
npm i -g netlify-cli
```

2. **Deploy:**
```bash
netlify deploy --prod
```

3. **Set Environment Variables in Netlify Dashboard**

### Option 3: Manual Build

```bash
cd frontend
npm run build
# Deploy the 'dist' folder to any static hosting service
```

## Map Features

### Vector Tiles
- Uses MapTiler's OpenStreetMap style
- Provides smooth zooming and better performance
- Can be styled dynamically (future enhancement)

### Roads Layer
- Primary roads (red, thicker lines)
- Secondary roads (orange, thinner lines)
- Click on roads to see name and type

### POIs
- Color-coded by category:
  - Blue: Commercial
  - Purple: Shopping
  - Red: Landmark
  - Green: Religious
  - Orange: Transport
  - Light Green: Park
  - Pink: Cultural
- Click markers for detailed information

### Administrative Boundaries
- Islamabad F-Sectors outlined
- Blue borders with semi-transparent fill
- Click boundaries for sector information

## Next Steps (Part 2 & 3)
- API endpoints for routing and geocoding
- Data enrichment pipelines
- Additional map layers and interactions

## Notes
- MapTiler free tier has rate limits (100,000 requests/month)
- For production, consider generating your own vector tiles
- Backend API is optional - map works with static data if backend is unavailable
