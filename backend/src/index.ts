import express, { Request, Response } from 'express';
import { createClient, ResponseJSON } from '@clickhouse/client';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { Pool } from 'pg';
import { createClient as createRedisClient, RedisClientType } from 'redis';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize Redis client
const redisClient = createRedisClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 10_000, // 10s timeout
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        console.error('[Redis] Retry limit exceeded');
        return new Error('Retry limit exceeded');
      }
      return Math.min(100 * retries, 3000); // exponential backoff
    },
  },
  database: 1,
});

redisClient.on('error', (err: Error) => {
  console.error('Redis Client Error:', err);
});
redisClient.connect().catch(console.error);

// Cache implementation
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class MemoryCache {
  private cache: Record<string, CacheEntry<any>> = {};
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const timestamp = Date.now();
    this.cache[key] = {
      data,
      timestamp,
      expiry: timestamp + ttl
    };
    console.log(`Cached data for key: ${key}`);
  }

  get<T>(key: string): T | null {
    const entry = this.cache[key];
    if (!entry) {
      console.log(`Cache miss for key: ${key}`);
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiry) {
      console.log(`Cache expired for key: ${key}`);
      delete this.cache[key];
      return null;
    }

    console.log(`Cache hit for key: ${key}`);
    return entry.data as T;
  }

  invalidate(key: string): void {
    if (this.cache[key]) {
      delete this.cache[key];
      console.log(`Cache invalidated for key: ${key}`);
    }
  }

  invalidateAll(): void {
    this.cache = {};
    console.log('All cache entries invalidated');
  }
}

const cache = new MemoryCache();

// Mapping tables cache
interface DeviceVehicleMapping {
  device_id: string;
  vehicle_no: string;
}

interface VehicleRouteMapping {
  vehicle_no: string;
  route_id: string;
}

interface Route {
  integrated_bpp_config_id: string;
  code: string;
  short_name: string;
}

// Global caches for mapping tables to reduce database queries
let deviceVehicleMap: Record<string, string> = {}; // device_id -> vehicle_no
let vehicleRouteMap: Record<string, string> = {};  // vehicle_no -> route_id
let routeCodeMap: Record<string, string[]> = {};  // short_name -> code[]
let mappingTablesLastUpdated = 0;
const MAPPING_TABLES_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

// Initialize Clickhouse client
const client = createClient({
  host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER,
  compression: {
    response: true,
    request: true,
  },
  password: process.env.CLICKHOUSE_PASSWORD,
});

// Initialize PostgreSQL client with connection error handling
let pgPool: Pool | null = null;
try {
  pgPool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
  });
  
  // Add error handler for connection issues
  pgPool.on('error', (err) => {
    console.error('Unexpected PostgreSQL connection error:', err);
    // Don't kill the server on connection errors
  });
  
  console.log('PostgreSQL connection pool initialized');
  
  // Initial load of mapping tables
  refreshMappingTables();
} catch (error) {
  console.error('Failed to initialize PostgreSQL connection pool:', error);
  // Continue without PostgreSQL - the app will work without route information
}

// Function to refresh mapping tables from PostgreSQL
async function refreshMappingTables() {
  if (!pgPool) return;
  
  const now = Date.now();
  // Only refresh if it's been more than the refresh interval since last update
  if (now - mappingTablesLastUpdated < MAPPING_TABLES_REFRESH_INTERVAL) {
    console.log('Mapping tables recently refreshed, skipping update');
    return;
  }
  
  console.log('Refreshing mapping tables from PostgreSQL');
  
  try {
    // Fetch the device to vehicle mapping
    const deviceVehicleResult = await pgPool.query<DeviceVehicleMapping>(
      'SELECT device_id, vehicle_no FROM atlas_app.device_vehicle_mapping;'
    );
    
    // Update the device to vehicle map
    const newDeviceVehicleMap: Record<string, string> = {};
    deviceVehicleResult.rows.forEach(row => {
      newDeviceVehicleMap[row.device_id] = row.vehicle_no;
    });
    deviceVehicleMap = newDeviceVehicleMap;
    
    console.log(`Loaded ${Object.keys(deviceVehicleMap).length} device-to-vehicle mappings`);

    const routeResult = await pgPool.query<Route>(
      "SELECT integrated_bpp_config_id, code, short_name FROM atlas_app.route where integrated_bpp_config_id = 'b0454b15-9755-470d-a16a-71e87695e003';"
    );
    
    // Update the route code map
    const newRouteCodeMap: Record<string, string[]> = {};
    routeResult.rows.forEach(row => {
      if (!newRouteCodeMap[row.short_name]) {
        newRouteCodeMap[row.short_name] = [];
      }
      newRouteCodeMap[row.short_name].push(row.code);
    });
    routeCodeMap = newRouteCodeMap;
    
    console.log(`Loaded ${Object.keys(routeCodeMap).length} route mappings with ${routeResult.rowCount} total routes`);
    
    // Fetch the vehicle to route mapping
    // const vehicleRouteResult = await pgPool.query<VehicleRouteMapping>(
    //   "SELECT vehicle_no, route_id FROM atlas_app.vehicle_route_mapping where integrated_bpp_config_id='b0454b15-9755-470d-a16a-71e87695e003';"
    // );
    
    // // Update the vehicle to route map
    // const newVehicleRouteMap: Record<string, string> = {};
    // vehicleRouteResult.rows.forEach(row => {
    //   newVehicleRouteMap[row.vehicle_no] = row.route_id;
    // });
    // vehicleRouteMap = newVehicleRouteMap;
    
    // console.log(`Loaded ${Object.keys(vehicleRouteMap).length} vehicle-to-route mappings`);

    // Update last refresh timestamp
    mappingTablesLastUpdated = now;
  } catch (error) {
    console.error('Error refreshing mapping tables:', error);
  }
}

// Set up a periodic refresh of mapping tables
setInterval(refreshMappingTables, MAPPING_TABLES_REFRESH_INTERVAL);

const OSRM_SERVER = process.env.OSRM_SERVER || 'https://router.project-osrm.org';

interface RouteQuery {
  fromLat?: string;
  fromLng?: string;
  toLat?: string;
  toLng?: string;
}

interface VehicleQuery {
  startTime?: string;
  endTime?: string;
  deviceId?: string;
  bypassCache?: string;
}

interface VehicleData {
  deviceId: string;
  vehicleNumber: string | null;
  routeNumber: string;
  provider: string | null;
  routeId: string | null;
  trail: Array<{
    lat: number;
    lng: number;
    timestamp: string;
  }>;
}

// Define a type for the ClickHouse result to fix TypeScript errors
interface ClickHouseVehicleData {
  deviceId: string;
  vehicleNumber: string | null;
  routeNumber: string;
  provider: string | null;
  lat: number | null;
  lng: number | null;
  timestamp: string;
}

// Redis data types (in snake_case)
interface RedisVehicleData {
  device_id: string;
  vehicle_number: string;
  route_number: string;
  route_id: string | null;
  provider: string | null;
  latitude: number;
  longitude: number;
  speed: number;
  timestamp: number; // epoch timestamp
  eta_data: Array<{
    stop_name: string;
    arrival_time: number; // epoch timestamp
  }>;
}

// Function to convert Redis data to API response format
function convertRedisToApiFormat(redisData: RedisVehicleData) {
  return {
    deviceId: redisData.device_id,
    vehicleNumber: redisData.vehicle_number,
    latitude: redisData.latitude,
    longitude: redisData.longitude,
    speed: redisData.speed,
    timestamp: new Date(redisData.timestamp * 1000).toISOString(), // Convert epoch to ISO string
    etaData: redisData.eta_data.map(eta => ({
      stopName: eta.stop_name,
      arrivalTime: new Date(eta.arrival_time * 1000).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }))
  };
}

// Time utility functions
function formatDateToIST(date: Date): string {
  const istT = convertToIST(date)
  // Format as YYYY-MM-DD HH:MM:SS
  return istT.toISOString().replace('T', ' ').split('.')[0];
}

// Convert UTC date to IST date
function convertToIST(date: Date): Date {
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  return new Date(date.getTime() + istOffset);
}

// Get current time in IST
function getCurrentTimeIST(): Date {
  return convertToIST(new Date());
}

// Get readable IST timestamp
function getReadableISTTime(date: Date = new Date()): string {
  const istDate = convertToIST(date);
  return istDate.toISOString().replace('T', ' ').split('.')[0] + ' IST';
}

// Health check and time debug endpoint
app.get('/api/health', (req: Request, res: Response): void => {
  const now = new Date();
  const ist = getCurrentTimeIST();
  
  res.json({
    status: 'healthy',
    serverTime: {
      utc: now.toISOString(),
      ist: ist.toISOString(),
      readableIST: getReadableISTTime(now)
    },
    timeZoneOffset: {
      server: -now.getTimezoneOffset() / 60,
      ist: 5.5
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      clickhouseHost: process.env.CLICKHOUSE_HOST || 'http://localhost:8123'
    },
    mappingTables: {
      deviceVehicleMappingsCount: Object.keys(deviceVehicleMap).length,
      vehicleRouteMappingsCount: Object.keys(vehicleRouteMap).length,
      lastUpdated: new Date(mappingTablesLastUpdated).toISOString()
    }
  });
});

// API endpoint to fetch vehicle locations with routes
app.get('/api/vehicles', async (req: Request<{}, any, any, VehicleQuery>, res: Response): Promise<void> => {
  try {
    const { startTime, endTime, deviceId, bypassCache } = req.query;

    console.log("startTime:", startTime)
    
    // Current timestamp for comparison - all times assumed to be in IST
    const now = new Date();
    let isRecentRequest = false;
    let cacheKey = '';
    let shouldBypassCache = bypassCache === 'true';
    
    // If deviceId is specified, we're looking for a specific bus
    if (deviceId) {
      cacheKey = `vehicle_${deviceId}_${startTime || 'default'}_${endTime || 'default'}`;
      console.log(`Fetching specific vehicle with ID: ${deviceId}`);
    } else {
      // Check the timeframe of the request
      if (endTime) {
        const requestEndTime = new Date(endTime);
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        
        isRecentRequest = requestEndTime > fiveMinutesAgo && requestEndTime <= now;
      }
      
      if (isRecentRequest) {
        // For recent requests (within 5 minutes), use the real-time cache key
        cacheKey = 'vehicles_realtime';
        console.log('Using real-time cache key for recent request (last 5 minutes)');
      } else {
        // For historical data, use precise startTime and endTime
        cacheKey = `vehicles_${startTime || 'default'}_${endTime || 'default'}`;
        console.log('Using historical cache key for past data request');
      }
    }
    
    // Explicitly log that we're using IST timestamps
    console.log('All timestamps are interpreted as IST (UTC+5:30)');
    
    // Check if we have cached data and should use it
    if (!shouldBypassCache) {
      const cachedData = cache.get<VehicleData[]>(cacheKey);
      if (cachedData) {
        console.log(`Returning cached vehicle data (${cachedData.length} vehicles) for key: ${cacheKey}`);
        
        // If deviceId is specified, filter the cached data to only return that vehicle
        if (deviceId) {
          const filteredData = cachedData.filter(vehicle => vehicle.deviceId === deviceId);
          if (filteredData.length > 0) {
            res.json(filteredData);
            return;
          }
          // If not found in cache, continue to fetch from database
        } else {
          const end = new Date();
          const duration = end.getTime() - now.getTime();
          console.log(`CacheDuration hit for key: ${cacheKey}, duration: ${duration}ms`);
          res.json(cachedData);
          return;
        }
      }
    } else {
      console.log(`Cache bypass requested for key: ${cacheKey}`);
    }

    // Default to appropriate time range if no time range provided
    const defaultEndTime = new Date();
    const defaultStartTime = new Date(defaultEndTime.getTime() - 5 * 60 * 1000); // Last 5 minutes for others

    const queryStartTime = startTime ? new Date(startTime) : defaultStartTime;
    const queryEndTime = endTime ? new Date(endTime) : defaultEndTime;

    // Format dates for ClickHouse in IST timezone
    const istStartTime = formatDateToIST(queryStartTime);
    const istEndTime = formatDateToIST(queryEndTime);

    console.log(`Querying data from ${queryStartTime} to ${istEndTime} (IST)`);

    // Build the query - with deviceId filter if specified
    let query = `
      SELECT deviceId, vehicleNumber, routeNumber, provider, lat, long as lng, timestamp
          FROM atlas_kafka.amnex_direct_data
          WHERE timestamp > '${istStartTime}' AND timestamp <= '${istEndTime}'
          ${deviceId ? `AND deviceId = '${deviceId}'` : ''};
    `;
    
    console.log("Executing ClickHouse query:", query);

    const result = await client.query({
      query,
      format: 'JSONEachRow',
    });

    const rawData = await result.json() as any[];
    console.log(`Got ${rawData.length} points from ClickHouse`);
    
    // Group points by deviceId
    const deviceMap: Record<string, VehicleData> = {};
    
    // Refresh mapping tables if needed before processing vehicle data
    await refreshMappingTables();
    
    // Process each point
    for (const point of rawData) {
      const { deviceId: pointDeviceId, vehicleNumber, routeNumber, provider, lat, lng, timestamp } = point;
      
      // Skip invalid points
      if (lat === null || lng === null || lat === 0 || lng === 0) continue;
      
      // Initialize device data if not exists
      if (!deviceMap[pointDeviceId]) {
        // Look up vehicle number from device-vehicle mapping
        const mappedVehicleNumber = deviceVehicleMap[pointDeviceId] || vehicleNumber;
        
        // Look up route ID from vehicle-route mapping (if we have a vehicle number)
        const routeId = mappedVehicleNumber ? vehicleRouteMap[mappedVehicleNumber] || null : null;
        
        deviceMap[pointDeviceId] = {
          deviceId: pointDeviceId,
          vehicleNumber: mappedVehicleNumber,
          routeNumber,
          provider,
          routeId,
          trail: []
        };
      }
      
      // Add point to trail
      deviceMap[pointDeviceId].trail.push({
        lat,
        lng,
        timestamp
      });
    }

    for (const vehicle of Object.values(deviceMap)) {
      vehicle.trail.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    
    // Convert map to array and filter vehicles without trail points
    const data = Object.values(deviceMap).filter(vehicle => vehicle.trail.length > 0);
    
    // Set appropriate cache TTL based on request type
    let cacheTTL = 5 * 60 * 1000; // Default: 5 minutes for historical
    
    if (deviceId) {
      // For specific vehicle requests, use a shorter TTL
      cacheTTL = 10 * 1000; // 10 seconds for specific vehicle
    } else if (isRecentRequest) {
      cacheTTL = 30 * 1000; // 30 seconds for data within 5 minutes
    }
    
    // Only cache if not bypassing cache
    if (!shouldBypassCache) {
      // Cache the result with its appropriate TTL
      console.log(`Caching ${data.length} vehicles with TTL ${cacheTTL}ms for key: ${cacheKey}`);
      cache.set(cacheKey, data, cacheTTL);
    }
    const end = new Date();
    const duration = end.getTime() - now.getTime();
    console.log(`CacheDuration miss for key: ${cacheKey}, duration: ${duration}ms`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching data:', error);
    // Provide more detailed error information
    if (error instanceof Error) {
      res.status(500).json({ 
        error: 'Failed to fetch vehicle data', 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } else {
      res.status(500).json({ error: 'Failed to fetch vehicle data' });
    }
  }
});

// API endpoint to get route between two points
app.get('/api/route', async (req: Request<{}, any, any, RouteQuery>, res: Response): Promise<void> => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;
    
    if (!fromLat || !fromLng || !toLat || !toLng) {
      res.status(400).json({ error: 'Missing coordinates' });
      return;
    }

    // Create a cache key based on the query parameters
    const cacheKey = `route_${fromLat}_${fromLng}_${toLat}_${toLng}`;
    
    // Check if we have cached data
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      res.json(cachedData);
      return;
    }

    const response = await axios.get(
      `${OSRM_SERVER}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}`, {
        params: {
          overview: 'full',
          geometries: 'geojson',
          steps: true
        }
      }
    );

    // Cache and return the data
    cache.set(cacheKey, response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching route:', error);
    res.status(500).json({ error: 'Failed to fetch route' });
  }
});

// API endpoint to get daily coverage statistics by provider
app.get('/api/coverage/daily', async (req: Request, res: Response): Promise<void> => {
  try {
    // Create a cache key - for coverage we use a fixed key since it's always for the last 24 hours
    const cacheKey = 'coverage_daily';
    
    // Check if we have cached data
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      res.json(cachedData);
      return;
    }

    // Calculate date range for the last 24 hours
    const endTime = new Date();
    const startTime = new Date(endTime);
    startTime.setDate(startTime.getDate() - 1); // 24 hours ago
    
    // Format dates for ClickHouse in IST timezone
    const istStartTime = formatDateToIST(startTime);
    const istEndTime = formatDateToIST(endTime);
    
    console.log(`Fetching daily coverage from ${istStartTime} to ${istEndTime} (IST)`);
    
    // Query for distinct deviceIds by provider for the last 24 hours
    const query = `
      SELECT 
        provider,
        count(DISTINCT deviceId) as deviceCount
      FROM atlas_kafka.amnex_direct_data
      WHERE timestamp >= '${istStartTime}'
        AND timestamp <= '${istEndTime}'
        AND lat != 0 
        AND long != 0
        AND deviceId != ''
      GROUP BY provider
      ORDER BY deviceCount DESC
    `;
    
    console.log("Executing ClickHouse coverage queries");
    
    const providerResult = await client.query({
      query,
      query_params: {
        start: istStartTime,
        end: istEndTime
      },
      format: 'JSONEachRow',
    });
    
    const providerData = await providerResult.json();
    
    console.log("Provider coverage data:", JSON.stringify(providerData));
    
    // Check if we have any provider data
    if (!providerData || !Array.isArray(providerData) || providerData.length === 0) {
      console.log("No provider data found, returning mock data for testing");
      
      // Return mock data for testing
      const mockResponse = {
        totalDevices: 2500,
        totalCoverage: 67.5,
        providerCoverage: [
          {
            provider: "amnex",
            deviceCount: 1500,
            coverage: 40.5
          },
          {
            provider: "chalo",
            deviceCount: 1000,
            coverage: 27.0
          }
        ],
        timestamp: new Date().toISOString()
      };
      
      // Cache and return the data
      cache.set(cacheKey, mockResponse);
      res.json(mockResponse);
      return;
    }
    
    // Format the response with coverage data
    const response = {
      totalDevices: 3700,
      providerCoverage: providerData.map((item: any) => ({
        provider: item.provider || 'unknown',
        deviceCount: item.deviceCount,
        coverage: parseFloat(((item.deviceCount / 3700) * 100).toFixed(2))
      })),
      timestamp: new Date().toISOString()
    };
    
    // Cache and return the data
    cache.set(cacheKey, response);
    res.json(response);
  } catch (error) {
    console.error('Error fetching coverage data:', error);
    if (error instanceof Error) {
      res.status(500).json({ 
        error: 'Failed to fetch coverage data', 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } else {
      res.status(500).json({ error: 'Failed to fetch coverage data' });
    }
  }
});

// API endpoint to refresh mapping tables manually
app.post('/api/mappings/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    await refreshMappingTables();
    res.json({ 
      success: true, 
      message: 'Mapping tables refreshed successfully',
      stats: {
        deviceVehicleMappings: Object.keys(deviceVehicleMap).length,
        vehicleRouteMappings: Object.keys(vehicleRouteMap).length,
        lastUpdated: new Date(mappingTablesLastUpdated).toISOString()
      }
    });
  } catch (error) {
    console.error('Error refreshing mapping tables:', error);
    res.status(500).json({ error: 'Failed to refresh mapping tables' });
  }
});

// API endpoint to invalidate cache
app.post('/api/cache/invalidate', (req: Request, res: Response): void => {
  try {
    const { key } = req.body;
    
    if (key) {
      // Invalidate specific cache key
      cache.invalidate(key);
      res.json({ success: true, message: `Cache for ${key} invalidated` });
    } else {
      // Invalidate all cache
      cache.invalidateAll();
      res.json({ success: true, message: 'All cache invalidated' });
    }
  } catch (error) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

interface RouteParams {
  routeId: string;
}

interface RouteVehicle {
  deviceId: string;
  vehicleNumber: string;
  routeId: string;
  routeName: string;
  provider: string | null;
  lastSeen: string;
  etaData: Array<{
    stop_name: string;
    arrival_time: number; // epoch timestamp
  }>;
  location: {
    lat: number;
    lng: number;
  };
  trail: Array<{
    lat: number;
    lng: number;
    timestamp: string;
  }>;
}

interface ErrorResponse {
  error: string;
}

type RouteVehicleResponse = RouteVehicle[] | ErrorResponse;

// API endpoint to fetch vehicles by route ID
app.get<RouteParams, RouteVehicleResponse>('/api/route-vehicles/:routeId', async (req, res) => {
  try {
    const routeId = req.params.routeId;
    const routeKey = `route:${routeId}`;
    
    const vehicles: RouteVehicle[] = [];
    const deviceIds = new Set<string>();
    const vehicleDataRaw = await redisClient.hGetAll(routeKey);
    console.log("vehicleDataRaw", JSON.stringify(vehicleDataRaw))
    // First get current locations from Redis
    for (const vehicleNumber of Object.keys(vehicleDataRaw)) {
      const data = vehicleDataRaw[vehicleNumber];
      if (data) {
        const vehicleData = JSON.parse(data);
        if (vehicleData.route_id === routeId) {
          deviceIds.add(vehicleData.device_id);
          vehicles.push({
            vehicleNumber: vehicleNumber,
            deviceId: vehicleData.device_id,
            routeId: vehicleData.route_id,
            routeName: vehicleData.route_name,
            provider: vehicleData.provider,
            lastSeen: vehicleData.last_seen,
            etaData: vehicleData.eta_data,
            location: {
              lat: vehicleData.latitude,
              lng: vehicleData.longitude
            },
            trail: []
          });
        }
      }
    }

    // If no vehicles found for the given routeId, check the route table
    if (vehicles.length === 0 && routeCodeMap[routeId]) {
      console.log(`No vehicles found for route ID ${routeId}, checking route codes`, routeCodeMap[routeId]);
      
      // Get all route codes for the given short_name
      const routeCodes = routeCodeMap[routeId];
      
      // Check each route code in Redis
      for (const routeCode of routeCodes) {
        const alternateRouteKey = `route:${routeCode}`;
        const alternateVehicleDataRaw = await redisClient.hGetAll(alternateRouteKey);
        console.log(`Checking alternate route code ${routeCode}`, Object.keys(alternateVehicleDataRaw).length);
        
        for (const vehicleNumber of Object.keys(alternateVehicleDataRaw)) {
          const data = alternateVehicleDataRaw[vehicleNumber];
          if (data) {
            const vehicleData = JSON.parse(data);
            deviceIds.add(vehicleData.device_id);
            vehicles.push({
              vehicleNumber: vehicleNumber,
              deviceId: vehicleData.device_id,
              routeId: routeCode,
              routeName: vehicleData.route_name || routeCode,
              provider: vehicleData.provider,
              lastSeen: vehicleData.last_seen,
              etaData: vehicleData.eta_data || [],
              location: {
                lat: vehicleData.latitude,
                lng: vehicleData.longitude
              },
              trail: []
            });
          }
        }
      }
    }

    if (vehicles.length > 0) {
      // Get trail data from ClickHouse for the last 30 minutes
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 30 * 60 * 1000); // 30 minutes ago

      const istStartTime = formatDateToIST(startTime);

      const deviceIdsArray = Array.from(deviceIds);
      const deviceIdsStr = deviceIdsArray.map(id => `'${id}'`).join(',');

      const query = `
        SELECT deviceId, lat, long as lng, timestamp 
        FROM atlas_kafka.amnex_direct_data 
        WHERE ( timestamp >= toStartOfDay(now64(9)) ) 
        AND ( timestamp < toStartOfDay((now64(9) + INTERVAL 1 day)) ) 
        AND ( serverTime >= toStartOfDay(now64(9)) ) 
        AND ( serverTime < toStartOfDay((now64(9) + INTERVAL 1 day)) ) 
        AND deviceId IN (${deviceIdsStr})
        AND dataState IN ('LP', 'L', 'LO')
        AND lat != 0 AND long != 0
        ORDER BY timestamp DESC LIMIT 500;
      `;

      const result = await client.query({
        query,
        format: 'JSONEachRow',
      });

      const trailData = await result.json() as any[];

      // Group trail points by deviceId
      const trailsByDevice: Record<string, Array<{lat: number, lng: number, timestamp: string}>> = {};
      for (const point of trailData) {
        if (!trailsByDevice[point.deviceId]) {
          trailsByDevice[point.deviceId] = [];
        }
        trailsByDevice[point.deviceId].push({
          lat: point.lat,
          lng: point.lng,
          timestamp: point.timestamp
        });
      }

      // Add trail data to vehicles
      for (const vehicle of vehicles) {
        if (trailsByDevice[vehicle.deviceId]) {
          vehicle.trail = trailsByDevice[vehicle.deviceId].reverse();
        }
      }
    }

    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching route vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch route vehicles' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 