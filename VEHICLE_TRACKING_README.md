# Vehicle Tracking Dashboard

## Overview
A real-time vehicle tracking system that displays live vehicle locations on an interactive map with color-coded markers based on data freshness.

## Features

### 🚌 Real-time Vehicle Tracking
- **Fresh Data Pull**: On first load, fetches all vehicle data from Redis route keys
- **Auto-refresh**: Updates every 10 seconds with cached data from `bus_metadata_v2`
- **Live Map**: Interactive OpenStreetMap with vehicle markers

### 🎨 Visual Indicators
- **Green Markers**: Vehicles with last ping < 1 minute (Recent)
- **Orange Markers**: Vehicles with last ping 1-5 minutes (Moderate)
- **Red Markers**: Vehicles with last ping > 5 minutes (Old)

### 📊 Summary Dashboard
- Real-time count of vehicles by status
- Total vehicle count
- Visual cards with color-coded statistics

### 🔍 Interactive Features
- **Hover Tooltips**: Show vehicle details after 2-second hover
- **Click Popups**: Detailed vehicle information on marker click
- **Auto-refresh**: Seamless data updates without page reload

## API Endpoints

### Backend API
- **GET** `/api/vehicle-tracking?isFreshPull=true` - Fresh data pull
- **GET** `/api/vehicle-tracking?isFreshPull=false` - Cached data pull

### Response Format
```typescript
[
  {
    vehicleNo: string,
    deviceId: string,
    routeId: string,
    routeNumber: string,
    latitude: number,
    longitude: number,
    timestamp: number
  }
]
```

## Navigation
- **Route Tracker** (`/`) - Original route-based vehicle tracking
- **Live Tracking** (`/tracking`) - New real-time vehicle tracking
- **About** (`/about`) - Application information

## Technical Implementation

### Frontend
- **React 19** with TypeScript
- **Material-UI** for UI components
- **React-Leaflet** for map visualization
- **Axios** for API calls

### Backend
- **Node.js** with Express
- **Redis** for data storage
- **Parallel processing** for efficient data retrieval
- **Batch operations** (100 keys per batch)

### Data Flow
1. **Initial Load**: `isFreshPull=true` → Scan Redis route keys → Batch process → Filter OD vehicles
2. **Auto-refresh**: `isFreshPull=false` → Get from `bus_metadata_v2` → Update map
3. **Status Calculation**: Compare timestamps to determine marker colors
4. **UI Updates**: Real-time map and summary updates

## Getting Started

### Prerequisites
- Node.js 16+
- Redis server running
- Backend server running on port 3001

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm start
```

### Environment Variables
```env
REACT_APP_API_BASE_URL=http://localhost:3001/api
```

## Usage

1. **Navigate to Live Tracking**: Click "Live Tracking" in the navigation
2. **View Real-time Data**: Map automatically loads and updates
3. **Monitor Vehicle Status**: Check summary sidebar for counts
4. **Inspect Vehicles**: Hover over markers for details
5. **Refresh Manually**: Click refresh button for immediate update

## Performance Features

- **Parallel Processing**: Multiple Redis operations run simultaneously
- **Batch Operations**: Efficient data retrieval in chunks of 100
- **Smart Caching**: Fresh pull on load, cached updates for refresh
- **Optimized Rendering**: Only updates changed vehicle data

## Error Handling

- **Network Errors**: Graceful fallback with error messages
- **Data Validation**: Robust parsing with error recovery
- **Loading States**: Visual feedback during data fetching
- **Retry Logic**: Automatic retry on failed requests

## Future Enhancements

- [ ] Vehicle filtering by route
- [ ] Historical data playback
- [ ] Export functionality
- [ ] Mobile-optimized interface
- [ ] Real-time notifications
- [ ] Advanced analytics dashboard
