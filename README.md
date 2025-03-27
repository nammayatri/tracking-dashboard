# Vehicle Tracking Application

This application shows real-time vehicle locations on a map using data from Clickhouse.

## Prerequisites

- Node.js (v14 or higher)
- npm
- Clickhouse database
- Google Maps API key

## Setup

### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following content:
   ```
   PORT=3001
   CLICKHOUSE_HOST=your_clickhouse_host
   CLICKHOUSE_USER=your_username
   CLICKHOUSE_PASSWORD=your_password
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Google Maps API key:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

The application will show vehicle locations on the map, updating every 5 seconds. Each marker represents a vehicle, and hovering over a marker will show the vehicle number and last update timestamp.

## Architecture

- Frontend: React with TypeScript, using Google Maps API for visualization
- Backend: Node.js with Express, connecting to Clickhouse for vehicle data
- Database: Clickhouse, specifically the `atlas_kafka.amnex_direct_data` table 