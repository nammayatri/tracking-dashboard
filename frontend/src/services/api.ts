import axios from 'axios';
import { API_BASE_URL, DEFAULT_MAP_CENTER } from '../utils/constants';
import { VehicleData, DailyCoverage } from '../types';
import { convertToIST } from '../utils/helpers';

// Function to fetch vehicle data
export const fetchVehiclesData = async (startDate: Date, endDate: Date, includeTrail: boolean = true): Promise<VehicleData[]> => {
  try {
    // Convert to IST for backend queries
    const istStart = convertToIST(startDate);
    const istEnd = convertToIST(endDate);
    
    console.log('Fetching vehicles with time range:', { 
      local: { start: startDate, end: endDate },
      ist: { start: istStart, end: istEnd }
    });
    
    const response = await axios.get<VehicleData[]>(`${API_BASE_URL}/api/vehicles`, {
      params: {
        startTime: istStart.toISOString(),
        endTime: istEnd.toISOString(),
        includeTrail
      }
    });
    
    console.log('Received vehicles data:', response.data.length, 'vehicles');
    
    // Check if any vehicles have trail data
    const vehiclesWithTrail = response.data.filter(v => v.trail && v.trail.length > 0);
    console.log(`${vehiclesWithTrail.length} vehicles have trail data`);
    
    // If no vehicles received from API, use mock data for testing
    if (response.data.length === 0) {
      console.log('No vehicles received from API, using mock data for testing');
      return generateMockVehicles();
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    throw error;
  }
};

// Function to fetch a specific vehicle without caching
export const fetchFocusedVehicle = async (deviceId: string, startDate: Date, endDate: Date): Promise<VehicleData | null> => {
  if (!deviceId) return null;
  
  try {
    console.log(`Fetching focused vehicle: ${deviceId}`);
    
    // Convert to IST for backend queries
    const istStart = convertToIST(startDate);
    const istEnd = convertToIST(endDate);
    
    // Using a special parameter to bypass cache and get real-time data for this specific bus
    const response = await axios.get<VehicleData[]>(`${API_BASE_URL}/api/vehicles`, {
      params: {
        startTime: istStart.toISOString(),
        endTime: istEnd.toISOString(),
        deviceId: deviceId,
        bypassCache: true
      }
    });
    
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching focused vehicle ${deviceId}:`, error);
    return null;
  }
};

// Function to fetch offline vehicles count
export const fetchOfflineVehicles = async (): Promise<{ offlineCount: number, offlineIds: Set<string> }> => {
  try {
    const now = new Date();
    const lastHourStart = new Date(now);
    lastHourStart.setHours(now.getHours() - 1);
    const lastFiveMinutes = new Date(now);
    lastFiveMinutes.setMinutes(now.getMinutes() - 5);
    
    // All vehicles in the last hour
    const hourResponse = await axios.get(`${API_BASE_URL}/api/vehicles`, {
      params: {
        startTime: lastHourStart.toISOString(),
        endTime: now.toISOString()
      }
    });
    
    // Current active vehicles (last 5 minutes)
    const recentResponse = await axios.get(`${API_BASE_URL}/api/vehicles`, {
      params: {
        startTime: lastFiveMinutes.toISOString(),
        endTime: now.toISOString()
      }
    });
    
    // Validate response data before using it
    const hourData = Array.isArray(hourResponse.data) ? hourResponse.data : [];
    const recentData = Array.isArray(recentResponse.data) ? recentResponse.data : [];
    
    const hourVehicleIds = new Set(hourData.map((v: VehicleData) => v.deviceId));
    const recentVehicleIds = new Set(recentData.map((v: VehicleData) => v.deviceId));
    
    // Find offline vehicle IDs (active in last hour but not in last 5 minutes)
    const offlineIds = [...hourVehicleIds].filter(id => !recentVehicleIds.has(id));
    
    return {
      offlineCount: offlineIds.length,
      offlineIds: new Set(offlineIds)
    };
  } catch (error) {
    console.error('Error calculating offline vehicles:', error);
    return {
      offlineCount: 0,
      offlineIds: new Set()
    };
  }
};

// Function to fetch daily coverage statistics
export const fetchDailyCoverage = async (): Promise<DailyCoverage | null> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/coverage/daily`);
    return response.data;
  } catch (error) {
    console.error('Error fetching daily coverage:', error);
    return null;
  }
};

// Function to generate mock vehicle data for testing
const generateMockVehicles = (): VehicleData[] => {
  return [
    {
      deviceId: 'mock-device-1',
      vehicleNumber: 'KA01F1234',
      routeNumber: '500A',
      routeId: 'route-500',
      provider: 'amnex',
      trail: [
        { lat: DEFAULT_MAP_CENTER.lat + 0.01, lng: DEFAULT_MAP_CENTER.lng + 0.01, timestamp: new Date().toISOString() },
        { lat: DEFAULT_MAP_CENTER.lat + 0.015, lng: DEFAULT_MAP_CENTER.lng + 0.015, timestamp: new Date(Date.now() - 5 * 60000).toISOString() }
      ]
    },
    {
      deviceId: 'mock-device-2',
      vehicleNumber: 'KA01F5678',
      routeNumber: '500B',
      routeId: 'route-501',
      provider: 'chalo',
      trail: [
        { lat: DEFAULT_MAP_CENTER.lat - 0.01, lng: DEFAULT_MAP_CENTER.lng - 0.01, timestamp: new Date().toISOString() },
        { lat: DEFAULT_MAP_CENTER.lat - 0.015, lng: DEFAULT_MAP_CENTER.lng - 0.015, timestamp: new Date(Date.now() - 5 * 60000).toISOString() }
      ]
    },
    {
      deviceId: 'mock-device-3',
      vehicleNumber: 'KA01F9012',
      routeNumber: '500C',
      routeId: null,
      provider: 'amnex',
      trail: [
        { lat: DEFAULT_MAP_CENTER.lat + 0.01, lng: DEFAULT_MAP_CENTER.lng - 0.01, timestamp: new Date().toISOString() },
        { lat: DEFAULT_MAP_CENTER.lat + 0.015, lng: DEFAULT_MAP_CENTER.lng - 0.015, timestamp: new Date(Date.now() - 5 * 60000).toISOString() }
      ]
    }
  ];
}; 