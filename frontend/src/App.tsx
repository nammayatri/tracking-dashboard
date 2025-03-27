import { createTheme } from "@mui/material/styles";
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import './App.css';
import {
  ThemeProvider,
  CssBaseline,
  Divider,
  LinearProgress,
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  SelectChangeEvent,
  IconButton,
  Alert,
  Autocomplete,
  Snackbar,
  Slider,
  InputAdornment,
  CircularProgress,
  Chip
} from '@mui/material';
import VehicleMarker from './components/VehicleMarker';
import VehicleTrail from './components/VehicleTrail';
import PlaybackControls from './components/PlaybackControls';
import AnimatedVehicleMarker from './components/AnimatedVehicleMarker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearIcon from '@mui/icons-material/Clear';
import DirectionsIcon from '@mui/icons-material/Directions';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import { useMap } from 'react-leaflet';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FastForwardIcon from '@mui/icons-material/FastForward';
import SpeedIcon from '@mui/icons-material/Speed';

// Fix for default marker icons in Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Setup Leaflet default icon
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Create theme instance with Material Design
const theme = createTheme({
  palette: {
    primary: {
      main: '#4285F4', // Google Blue
    },
    secondary: {
      main: '#34A853', // Google Green
    },
    error: {
      main: '#EA4335', // Google Red
    },
    warning: {
      main: '#FBBC05', // Google Yellow
    },
    background: {
      default: '#F5F5F5',
    }
  },
  typography: {
    fontFamily: [
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif'
    ].join(','),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        },
      },
    },
  },
});

// Constants
const API_BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:3001';
const DEFAULT_MAP_CENTER = { lat: 12.9716, lng: 77.5946 }; // Default fallback if no vehicles
const MAX_POINT_DISTANCE_KM = 0.5; // Maximum distance in km between consecutive points in a trail
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes refresh interval for general data
const DEFAULT_TIME_RANGE = 60; // Default time range in minutes
const FOCUSED_BUS_REFRESH_INTERVAL = 10 * 1000; // 10 seconds refresh interval for focused bus

// Types
interface TrailPoint {
  lat: number;
  lng: number;
  timestamp: string;
}

interface VehicleData {
  deviceId: string;
  vehicleNumber: string;
  routeNumber: string;
  routeId: string | null;
  provider: string | null;
  trail: Array<{
    lat: number;
    lng: number;
    timestamp: string;
  }>;
  prevPosition?: { // Add this optional property to fix type errors
    lat: number;
    lng: number;
    timestamp: string;
  };
}

// Provider color mapping with more distinctive colors
const PROVIDER_COLORS: Record<string, string> = {
  amnex: '#4285F4', // Google Blue
  chalo: '#34A853', // Google Green
  default: '#EA4335'  // Google Red
};

// Create custom marker icons with different colors
const createColoredIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 0 5px rgba(0,0,0,0.5);
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

// Create a small marker for trail points
const createTrailPointIcon = (color: string): L.DivIcon => {
  return L.divIcon({
    className: 'trail-point-icon',
    html: `<div style="
      background-color: ${color};
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 1px solid white;
      box-shadow: 0 0 3px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4]
  });
};

// Create a simple debounce function
const debounce = <F extends (...args: any[]) => any>(
  func: F,
  waitFor: number
): ((...args: Parameters<F>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): void => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
};

// Add new types for the coverage data
interface ProviderCoverage {
  provider: string;
  deviceCount: number;
  coverage: number;
}

interface DailyCoverage {
  totalDevices: number;
  totalCoverage: number;
  providerCoverage: ProviderCoverage[];
  timestamp: string;
  totalFleetSize?: number; // Add this field for total fleet size
}

// Function to calculate distance between two points using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
};

// MapController component to handle map events and updates
function MapController() {
  const map = useMap();
  
  // Force map to invalidate size and recalculate dimensions
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
      // Store map reference in a global variable
      (window as any).leafletMap = map;
    }, 100);
  }, [map]);
  
  return null;
}

function App() {
  // State variables
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [offlineVehicles, setOfflineVehicles] = useState<number>(0);
  const [offlineVehicleIds, setOfflineVehicleIds] = useState<Set<string>>(new Set());
  const [isUserInteracting, setIsUserInteracting] = useState<boolean>(false);
  const [dailyCoverage, setDailyCoverage] = useState<DailyCoverage | null>(null);
  const [coverageLoading, setCoverageLoading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Only for initial load
  const [error, setError] = useState<string | null>(null);
  const [focusedVehicle, setFocusedVehicle] = useState<string | null>(null);
  
  // Table view states
  const [showBusesTable, setShowBusesTable] = useState<boolean>(false);
  const [showRoutesTable, setShowRoutesTable] = useState<boolean>(false);
  const [availableRoutes, setAvailableRoutes] = useState<string[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [filteredVehicles, setFilteredVehicles] = useState<VehicleData[]>([]);
  
  // Route search states
  const [searchRoute, setSearchRoute] = useState<string>('');
  const [routeError, setRouteError] = useState<string | null>(null);
  const [showError, setShowError] = useState<boolean>(false);
  
  // Vehicle search states
  const [searchVehicle, setSearchVehicle] = useState<string>('');
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  
  // Refs for interval and debounce timers
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Time range state
  const [startTime, setStartTime] = useState<Date>(() => {
    const date = new Date();
    date.setHours(date.getHours() - 1);
    return date;
  });
  const [endTime, setEndTime] = useState<Date>(new Date());

  // State for the new 24-hour time slider and date selector
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    // Reset time to beginning of the day
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [selectedHour, setSelectedHour] = useState<number>(new Date().getHours());

  // Slider state for time window
  const [timeWindowMinutes, setTimeWindowMinutes] = useState<number>(60);

  // For offline vehicles calculation
  const [lastHourStart, setLastHourStart] = useState<Date>(() => {
    const date = new Date();
    date.setHours(date.getHours() - 1);
    return date;
  });

  // Add state for total fleet size
  const [totalFleetSize, setTotalFleetSize] = useState<number>(3700); // Default total fleet size

  // Animation states for bus playback
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackPosition, setPlaybackPosition] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(4); // 4x for faster playback by default
  const [animationVehicle, setAnimationVehicle] = useState<VehicleData | null>(null);
  const [sortedTrailPoints, setSortedTrailPoints] = useState<TrailPoint[]>([]);
  const [currentPointIndex, setCurrentPointIndex] = useState<number>(0);
  const [currentTargetTimestamp, setCurrentTargetTimestamp] = useState<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  
  // Fix the TIME_SCALE constant to make animation work correctly
  // Time scale: 1 second playback = 60 seconds real time 
  const TIME_SCALE = 60;

  // Add state for controlling refresh intervals
  const [focusedBusRefreshInterval, setFocusedBusRefreshInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // Function to convert local time to IST (for backend query)
  const convertToIST = (date: Date): Date => {
    // Create a new date object to avoid mutation
    const istDate = new Date(date);
    
    // Get the timezone offset in minutes for the current locale
    const localOffset = date.getTimezoneOffset();
    
    // IST is UTC+5:30, so offset is -330 minutes
    const istOffset = -330;
    
    // Calculate the time difference in minutes
    const diff = istOffset - localOffset;
    
    // Apply the difference to get IST time
    istDate.setMinutes(istDate.getMinutes() + diff);
    
    return istDate;
  };

  // Function to check if a date is in the future
  const isFutureDate = (date: Date): boolean => {
    const now = new Date();
    return date > now;
  };

  // Function to convert IST to local time (for display)
  const convertFromIST = (date: Date): Date => {
    // Create a new date object to avoid mutation
    const localDate = new Date(date);
    
    // Get the timezone offset in minutes for the current locale
    const localOffset = date.getTimezoneOffset();
    
    // IST is UTC+5:30, so offset is -330 minutes
    const istOffset = -330;
    
    // Calculate the time difference in minutes
    const diff = localOffset - istOffset;
    
    // Apply the difference to get local time
    localDate.setMinutes(localDate.getMinutes() + diff);
    
    return localDate;
  };

  // Function to fetch vehicle data
  const fetchVehicles = async () => {
    try {
      setLoading(true);
      
      // Calculate time range using selected date and hour
      const start = new Date(selectedDate);
      start.setHours(selectedHour);
      start.setMinutes(0);
      start.setSeconds(0);
      
      const end = new Date(selectedDate);
      end.setHours(selectedHour + 1);
      end.setMinutes(0);
      end.setSeconds(0);
      
      // Convert to IST for backend queries
      const istStart = convertToIST(start);
      const istEnd = convertToIST(end);
      
      console.log('Fetching vehicles with time range:', { 
        local: { start, end, hour: selectedHour },
        ist: { start: istStart, end: istEnd }
      });
      
      const response = await axios.get<VehicleData[]>(`${API_BASE_URL}/api/vehicles`, {
        params: {
          startTime: istStart.toISOString(),
          endTime: istEnd.toISOString(),
          includeTrail: true // Explicitly request trail data
        }
      });
      
      console.log('Received vehicles data:', response.data.length, 'vehicles');
      
      // Check if any vehicles have trail data
      const vehiclesWithTrail = response.data.filter(v => v.trail && v.trail.length > 0);
      console.log(`${vehiclesWithTrail.length} vehicles have trail data`);
      
      if (vehiclesWithTrail.length > 0) {
        const sampleVehicle = vehiclesWithTrail[0];
        console.log(`Sample vehicle ${sampleVehicle.deviceId} has ${sampleVehicle.trail.length} trail points`);
        console.log('First trail point:', JSON.stringify(sampleVehicle.trail[0]));
      }
      
      // Update the time range state
      setStartTime(start);
      setEndTime(end);
      
      // Check if we received any vehicles
      let vehiclesData = response.data;
      
      // If no vehicles received from API, use mock data for testing
      if (vehiclesData.length === 0) {
        console.log('No vehicles received from API, using mock data for testing');
        
        // Mock data for testing
        vehiclesData = [
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
      }
      
      // Smooth transition by transitioning from existing positions
      setVehicles(prevVehicles => {
        const vehicleMap = new Map(prevVehicles.map(v => [v.deviceId, v]));
        
        // Process each vehicle from the response
        const updatedVehicles = vehiclesData.map(newVehicle => {
          const prevVehicle = vehicleMap.get(newVehicle.deviceId);
          
          // If this vehicle already exists, preserve its previous position for smooth transitions
          if (prevVehicle && newVehicle.trail.length > 0 && prevVehicle.trail.length > 0) {
            // Add prevPosition property to marker for smooth transitions
            return {
              ...newVehicle,
              prevPosition: prevVehicle.trail[0]
            };
          }
          
          return newVehicle;
        });
        
        console.log('Updated vehicles state with', updatedVehicles.length, 'vehicles');
        
        // Extract unique route IDs and route numbers
        const routeSet = new Set<string>();
        updatedVehicles.forEach(vehicle => {
          if (vehicle.routeId) {
            routeSet.add(vehicle.routeId);
          } else if (vehicle.routeNumber) {
            routeSet.add(vehicle.routeNumber);
          }
        });
        
        setAvailableRoutes(Array.from(routeSet).sort());
        
        // Update filtered vehicles if a route is selected
        if (selectedRoute) {
          const filtered = updatedVehicles.filter(vehicle => 
            vehicle.routeId === selectedRoute || vehicle.routeNumber === selectedRoute
          );
          setFilteredVehicles(filtered);
        }
        
        return updatedVehicles;
      });
      
      // Turn off loading state
      setLoading(false);
      setIsLoading(false);
      setError(null);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      setLoading(false);
      setIsLoading(false);
    }
  };
  
  // Fix the fetchOfflineVehicles function to ensure it doesn't reset the count
  const fetchOfflineVehicles = useCallback(async () => {
    if (isUserInteracting) return; // Skip fetching if user is interacting with time inputs
    
    const now = new Date();
    const lastHourStart = new Date(now);
    lastHourStart.setHours(now.getHours() - 1);
    const lastFiveMinutes = new Date(now);
    lastFiveMinutes.setMinutes(now.getMinutes() - 5);
    
    try {
      console.log('Fetching offline vehicles data...');
      
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
      
      // Log what's happening with offline vehicles count
      console.log(`Offline vehicles calculation:`, {
        hourVehiclesCount: hourData.length,
        recentVehiclesCount: recentData.length,
        offlineCount: offlineIds.length
      });
      
      // Only update state if we get valid results (avoid resetting to 0 on errors)
      if (hourData.length > 0) {
        setOfflineVehicleIds(new Set(offlineIds));
        setOfflineVehicles(offlineIds.length);
      } else {
        console.log('No hour data vehicles received, keeping previous offline count');
      }
    } catch (error) {
      console.error('Error calculating offline vehicles:', error);
      // Don't update the state on error to keep the previous value
    }
  }, [isUserInteracting, API_BASE_URL]);

  // Create debounced version of fetchVehicles for time changes
  const debouncedFetchData = useMemo(
    () => debounce(() => {
      setIsUserInteracting(false);
      fetchVehicles();
      fetchOfflineVehicles();
    }, 800),
    [fetchVehicles, fetchOfflineVehicles]
  );

  // Function to calculate map center based on vehicle locations
  const calculateMapCenter = useCallback(() => {
    if (!vehicles.length) return DEFAULT_MAP_CENTER;
    
    // Calculate the center based on available vehicle positions
    let sumLat = 0;
    let sumLng = 0;
    let count = 0;
    
    vehicles.forEach(vehicle => {
      if (vehicle.trail.length > 0) {
        sumLat += vehicle.trail[0].lat;
        sumLng += vehicle.trail[0].lng;
        count++;
      }
    });
    
    if (count === 0) return DEFAULT_MAP_CENTER;
    
    return {
      lat: sumLat / count,
      lng: sumLng / count
    };
  }, [vehicles]);

  // Get the calculated map center
  const mapCenter = calculateMapCenter();

  // Update fetchDailyCoverage to also fetch total fleet size
  const fetchDailyCoverage = useCallback(async () => {
    if (isUserInteracting) return;
    
    try {
      setCoverageLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/coverage/daily`);
      setDailyCoverage(response.data);
      // Set total fleet size if available from the API
      if (response.data && response.data.totalFleetSize) {
        setTotalFleetSize(response.data.totalFleetSize);
      }
      setCoverageLoading(false);
    } catch (error) {
      console.error('Error fetching daily coverage:', error);
      setCoverageLoading(false);
    }
  }, [isUserInteracting]);

  // Fix the fetchFocusedVehicle function to prevent infinite loops
  const fetchFocusedVehicle = useCallback(async (deviceId: string) => {
    if (!deviceId) return;
    
    // Skip if user is interacting with time controls
    if (isUserInteracting) return;
    
    try {
      console.log(`Fetching focused vehicle: ${deviceId}`);
      
      // Calculate time range using selected date and hour
      const start = new Date(selectedDate);
      start.setHours(selectedHour);
      start.setMinutes(0);
      start.setSeconds(0);
      
      const end = new Date(selectedDate);
      end.setHours(selectedHour + 1);
      end.setMinutes(0);
      end.setSeconds(0);
      
      // Convert to IST for backend queries
      const istStart = convertToIST(start);
      const istEnd = convertToIST(end);
      
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
        const focusedVehicleData = response.data[0];
        
        // Only update if data actually changed to avoid unnecessary re-renders
        setVehicles(prevVehicles => {
          const existingVehicleIndex = prevVehicles.findIndex(v => v.deviceId === deviceId);
          if (existingVehicleIndex === -1) return prevVehicles; // Vehicle not found, don't update
          
          const existingVehicle = prevVehicles[existingVehicleIndex];
          
          // Check if the data is actually different
          const hasNewTrailPoints = focusedVehicleData.trail.length !== existingVehicle.trail.length ||
            JSON.stringify(focusedVehicleData.trail[0]) !== JSON.stringify(existingVehicle.trail[0]);
          
          // Only update if there are actual changes
          if (!hasNewTrailPoints) {
            console.log(`No changes detected for focused vehicle ${deviceId}, skipping update`);
            return prevVehicles;
          }
          
          console.log(`Updating focused vehicle ${deviceId} with new data`);
          const updatedVehicles = [...prevVehicles];
          updatedVehicles[existingVehicleIndex] = {
            ...focusedVehicleData,
            prevPosition: existingVehicle.trail[0] // Keep previous position for smooth animation
          };
          return updatedVehicles;
        });
      }
    } catch (error) {
      console.error(`Error fetching focused vehicle ${deviceId}:`, error);
    }
  }, [API_BASE_URL, selectedDate, selectedHour, convertToIST, isUserInteracting]);

  // Fix the useEffect hook with proper dependencies to avoid the infinite API call loop
  useEffect(() => {
    console.log('App component mounted - initializing data fetching');
    
    // Initial data fetch
    fetchVehicles()
      .then(() => fetchOfflineVehicles())
      .then(() => fetchDailyCoverage())
      .catch(err => console.error('Error in initial data fetch:', err));
    
    console.log('Setting up refresh interval');
    
    // Set up interval for periodic refresh
    const intervalId = setInterval(() => {
      // Only do background refreshes if user is not interacting with time controls
      // and not focusing on a specific bus (which has its own refresh)
      if (!isUserInteracting && !focusedVehicle) {
        console.log('General refresh interval triggered');
        
        // Run these in parallel to avoid one failure affecting others
        fetchVehicles().catch(err => console.error('Error refreshing vehicles:', err));
        fetchOfflineVehicles().catch(err => console.error('Error refreshing offline vehicles:', err));
        fetchDailyCoverage().catch(err => console.error('Error refreshing coverage data:', err));
      }
    }, REFRESH_INTERVAL);
    
    // Cleanup on unmount
    return () => {
      console.log('App component unmounting - cleaning up intervals');
      clearInterval(intervalId);
      if (focusedBusRefreshInterval) {
        clearInterval(focusedBusRefreshInterval);
      }
    };
  }, [focusedVehicle, isUserInteracting, focusedBusRefreshInterval]);

  // Make sure to clean up focused bus interval when component unmounts
  useEffect(() => {
    return () => {
      if (focusedBusRefreshInterval) {
        clearInterval(focusedBusRefreshInterval);
      }
    };
  }, []);

  // Effect to center map on vehicle positions once they're loaded
  useEffect(() => {
    if (!vehicles.length) return;
    
    // Get the map instance from the global variable
    const map = (window as any).leafletMap;
    if (!map) return;
    
    // Calculate bounds based on all vehicle positions
    const points: L.LatLngExpression[] = [];
    vehicles.forEach(vehicle => {
      if (vehicle.trail.length > 0) {
        points.push([vehicle.trail[0].lat, vehicle.trail[0].lng]);
      }
    });
    
    if (points.length > 0) {
      // Set view to fit all points if this is the first load
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [vehicles.length]);

  // Handle marker click to select a vehicle (removed OSRM route calculation)
  const handleMarkerClick = (vehicle: VehicleData) => {
    if (selectedVehicle === vehicle.deviceId) {
      // Deselect if clicking the same vehicle
      setSelectedVehicle(null);
    } else {
      // Select the clicked vehicle
      setSelectedVehicle(vehicle.deviceId);
    }
  };

  // Get color and icon based on provider
  const getVehicleColor = (provider: string | null): string => {
    if (!provider) return PROVIDER_COLORS.default;
    
    const lowerProvider = provider.toLowerCase();
    return PROVIDER_COLORS[lowerProvider as keyof typeof PROVIDER_COLORS] || PROVIDER_COLORS.default;
  };

  // Get marker icon based on whether it's selected or offline
  const getMarkerIcon = (isSelected: boolean, isOffline: boolean): L.DivIcon => {
    const color = isOffline ? '#EA4335' : '#1976d2'; // Default blue color if provider is unknown
    
    // Highlight selected vehicle
    if (isSelected) {
      // Make the selected icon larger and with a different color border
      return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          background-color: white;
          border: 3px solid ${color};
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: flex;
          justify-content: center;
          align-items: center;
          box-shadow: 0 0 0 2px white;
        "></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
    }
    
    // Regular vehicle marker
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        background-color: ${color};
        border-radius: 50%;
        width: 10px;
        height: 10px;
        box-shadow: 0 0 0 2px white;
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  };

  // Handle slider change for the hour of day
  const handleHourChange = (event: Event, newValue: number | number[]) => {
    const hour = newValue as number;
    
    // Check if selected hour is in the future for today
    const now = new Date();
    const isToday = selectedDate.getDate() === now.getDate() &&
                    selectedDate.getMonth() === now.getMonth() &&
                    selectedDate.getFullYear() === now.getFullYear();
    
    if (isToday && hour > now.getHours()) {
      // If trying to select a future hour today, limit to current hour
      setSelectedHour(now.getHours());
    } else {
      setSelectedHour(hour);
    }
    
    setIsUserInteracting(true);
    debouncedFetchData();
  };

  // Format hour for slider display
  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hourDisplay = hour % 12 === 0 ? 12 : hour % 12;
    return `${hourDisplay} ${ampm}`;
  };

  // Handle date change
  const handleDateChange = (date: Date | null) => {
    if (date) {
      // Don't allow selection of future dates
      if (isFutureDate(date)) {
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Set to beginning of today
        setSelectedDate(now);
        
        // If today is selected and the hour is in the future, adjust it
        if (selectedHour > new Date().getHours()) {
          setSelectedHour(new Date().getHours());
        }
      } else {
        setSelectedDate(date);
      }
      
      setIsUserInteracting(true);
      debouncedFetchData();
    }
  };
  // VehicleMarker component for displaying a vehicle at its position
  const VehicleMarker = ({ vehicle }: { vehicle: VehicleData }) => {
    const map = useMap();
    // Default to the latest position
    const currentPosition = vehicle.trail.length > 0 
      ? vehicle.trail[0] 
      : { lat: 0, lng: 0, timestamp: new Date().toISOString() };
    
    const isOffline = offlineVehicleIds.has(vehicle.deviceId);
    const isSelected = selectedVehicle === vehicle.deviceId;
    
    // Skip rendering regular marker if this vehicle is currently being animated
    if (isPlaying && animationVehicle?.deviceId === vehicle.deviceId) {
      return null;
    }
    
    return (
      <Marker
        position={[currentPosition.lat, currentPosition.lng]}
        icon={getMarkerIcon(isSelected, isOffline)}
        eventHandlers={{
          click: () => {
            console.log('Marker clicked for vehicle:', vehicle.deviceId);
            // When a marker is clicked, handle selection and centering
            handleMarkerClick(vehicle);
            handleVehicleSelect(vehicle.deviceId);
          }
        }}
      >
        <Popup>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            {vehicle.vehicleNumber || 'Unknown'}
          </Typography>
          {vehicle.routeNumber && (
            <Typography variant="body2">
              Route: {vehicle.routeNumber}
            </Typography>
          )}
          {vehicle.routeId && (
            <Typography variant="body2">
              Route ID: {vehicle.routeId}
            </Typography>
          )}
          {vehicle.provider && (
            <Typography variant="body2">
              Provider: {vehicle.provider}
            </Typography>
          )}
          <Typography variant="body2">
            Last updated: {new Date(currentPosition.timestamp).toLocaleTimeString()}
          </Typography>
          {isOffline && (
            <Chip 
              label="Offline" 
              size="small" 
              sx={{ 
                bgcolor: '#ffebee', 
                color: '#EA4335',
                marginTop: 1
              }} 
            />
          )}
          
          <Box sx={{ mt: 1 }}>
            <Button 
              size="small" 
              variant="contained" 
              fullWidth
              onClick={() => handleVehicleSelect(vehicle.deviceId)}
              startIcon={<PlayArrowIcon />}
              color="primary"
            >
              {vehicle.trail.length > 1 ? 'Show Playback' : 'Show Details'}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '10px', textAlign: 'center', mt: 0.5 }}>
              {vehicle.trail.length} trail points available
            </Typography>
          </Box>
        </Popup>
      </Marker>
    );
  };

  // TrailPointMarker component to show individual points along a route
  const TrailPointMarker = ({ point, color, index }: { point: TrailPoint; color: string; index: number }) => {
    return (
      <Marker
        position={[point.lat, point.lng]}
        icon={createTrailPointIcon(color)}
        zIndexOffset={-100 + index} // Make sure latest points appear on top
      >
        <Popup>
          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
            Point #{index + 1}
          </Typography>
          <Typography variant="body2">
            Time: {formatTimestamp(point.timestamp)}
          </Typography>
          <Typography variant="body2">
            Coordinates: {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
          </Typography>
        </Popup>
      </Marker>
    );
  };

  // Render vehicle trail with proper segmentation and individual points for selected vehicles
  const renderVehicleTrail = (vehicle: VehicleData, isOffline: boolean) => {
    // First, ensure trail points are sorted by timestamp (oldest to newest)
    const sortedTrail = [...vehicle.trail].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const trailSegments: Array<[number, number][]> = [];
    let currentSegment: [number, number][] = [];
    
    // Build segments based on sorted timestamps and distance threshold
    for (let i = 0; i < sortedTrail.length; i++) {
      const point: [number, number] = [sortedTrail[i].lat, sortedTrail[i].lng];
      
      if (i === 0) {
        // Start a new segment with the first point
        currentSegment = [point];
      } else {
        // Check distance from previous point
        const prevPoint = sortedTrail[i-1];
        const distance = calculateDistance(
          prevPoint.lat, prevPoint.lng, 
          sortedTrail[i].lat, sortedTrail[i].lng
        );
        
        if (distance <= MAX_POINT_DISTANCE_KM) {
          // Add to current segment if within threshold
          currentSegment.push(point);
        } else {
          // Distance too large, end current segment and start a new one
          if (currentSegment.length > 0) {
            trailSegments.push([...currentSegment]);
          }
          currentSegment = [point];
        }
      }
    }
    
    // Add the last segment if it has points
    if (currentSegment.length > 0) {
      trailSegments.push(currentSegment);
    }
    
    const isSelected = selectedVehicle === vehicle.deviceId;
    const trailColor = isOffline ? '#EA4335' : getVehicleColor(vehicle.provider);

  return (
    <>
        {/* Draw the polyline for the trail */}
        {trailSegments.map((segment, index) => (
          <Polyline
            key={`${vehicle.deviceId}-segment-${index}`}
            positions={segment}
            color={trailColor}
            weight={isOffline ? 2 : 3}
            opacity={isOffline ? 0.4 : 0.6}
            dashArray={isOffline ? "4, 4" : undefined}
          />
        ))}
        
        {/* If the vehicle is selected, also render individual trail points with timestamps */}
        {isSelected && sortedTrail.map((point, index) => (
          <TrailPointMarker 
            key={`${vehicle.deviceId}-point-${index}`} 
            point={point} 
            color={trailColor}
            index={index}
          />
        ))}
      </>
    );
  };

  // Update the handleVehicleSelect function to ensure trail points are properly set
  const handleVehicleSelect = (deviceId: string) => {
    console.log(`Vehicle selected: ${deviceId}`);
    
    // First stop any existing playback
    stopPlayback();
    
    // Set the vehicle as selected
    setSelectedVehicle(deviceId);
      
    // Find selected vehicle
    const foundVehicle = vehicles.find(v => v.deviceId === deviceId);
    console.log(`Looking for vehicle with deviceId ${deviceId}`);
    
    if (foundVehicle) {
      console.log(`Found vehicle ${deviceId} with ${foundVehicle.trail?.length || 0} trail points`);
      
      // Always set the animation vehicle first
      setAnimationVehicle(foundVehicle);
      
      // Generate demo data if no trail points or only one point
      if (!foundVehicle.trail || foundVehicle.trail.length < 2) {
        console.log('Not enough trail points, generating mock data');
        
        // Start with existing point or default
        const basePoint = foundVehicle.trail && foundVehicle.trail.length > 0 
          ? foundVehicle.trail[0] 
          : { 
              lat: 12.9716, 
              lng: 77.5946, 
              timestamp: new Date().toISOString() 
            };
            
        // Generate 10 mock trail points
        const mockTrail = Array.from({ length: 10 }, (_, i) => {
          return {
            lat: Number(basePoint.lat) + (i * 0.0005),
            lng: Number(basePoint.lng) + (i * 0.0005),
            timestamp: new Date(Date.now() - (9-i) * 5 * 60000).toISOString()
          };
        });
        
        console.log(`Generated ${mockTrail.length} mock trail points`);
        setSortedTrailPoints(mockTrail);
        setCurrentPointIndex(0);
        setPlaybackPosition(0);
        
        // Set the current timestamp for interpolation
        if (mockTrail.length > 0) {
          setCurrentTargetTimestamp(new Date(mockTrail[0].timestamp).getTime());
        }
        
        // Auto-start playback after a short delay to allow state updates
        setTimeout(() => {
          console.log("Auto-starting playback with mock data");
          startPlayback();
        }, 500);
        return;
      }
      
      try {
        // Create a safe copy with explicit number conversion to avoid issues
        const trailCopy = foundVehicle.trail.map(point => ({
          lat: typeof point.lat === 'string' ? parseFloat(point.lat) : Number(point.lat),
          lng: typeof point.lng === 'string' ? parseFloat(point.lng) : Number(point.lng),
          timestamp: point.timestamp
        }));
        
        console.log(`Made trail copy with ${trailCopy.length} points`);
        
        // Sort trail points by timestamp (oldest to newest)
        const sorted = [...trailCopy].sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeA - timeB; // This sorts from earliest to latest
        });
        
        console.log(`Sorted ${sorted.length} trail points`);
        
        if (sorted.length >= 2) {
          // Set sorted trail points and ensure currentPointIndex is reset
          setSortedTrailPoints(sorted);
          setCurrentPointIndex(0);
          setPlaybackPosition(0);
          
          // Set the current timestamp for interpolation
          if (sorted.length > 0) {
            setCurrentTargetTimestamp(new Date(sorted[0].timestamp).getTime());
          }
          
          // Auto-start playback after a short delay to allow state updates
          setTimeout(() => {
            console.log("Auto-starting playback with real data");
            startPlayback();
          }, 500);
        } else {
          // Not enough points after processing, generate mock data
          console.log('Not enough valid trail points after processing, using mock data');
          
          const basePoint = sorted.length > 0 ? sorted[0] : {
            lat: 12.9716, 
            lng: 77.5946, 
            timestamp: new Date().toISOString()
          };
          
          const mockTrail = Array.from({ length: 10 }, (_, i) => {
            return {
              lat: basePoint.lat + (i * 0.0005),
              lng: basePoint.lng + (i * 0.0005),
              timestamp: new Date(Date.now() - (9-i) * 5 * 60000).toISOString()
            };
          });
          
          console.log(`Generated ${mockTrail.length} mock trail points`);
          setSortedTrailPoints(mockTrail);
          setCurrentPointIndex(0);
          setPlaybackPosition(0);
          
          // Set the current timestamp for interpolation
          if (mockTrail.length > 0) {
            setCurrentTargetTimestamp(new Date(mockTrail[0].timestamp).getTime());
          }
          
          // Auto-start playback after a short delay to allow state updates
          setTimeout(() => {
            console.log("Auto-starting playback with fallback mock data");
            startPlayback();
          }, 500);
        }
      } catch (error) {
        console.error('Error processing trail points:', error);
        
        // Generate mock data on error
        console.log('Error in trail processing, using mock data');
        const mockTrail = Array.from({ length: 10 }, (_, i) => {
          return {
            lat: 12.9716 + (i * 0.0005),
            lng: 77.5946 + (i * 0.0005),
            timestamp: new Date(Date.now() - (9-i) * 5 * 60000).toISOString()
          };
        });
        
        setSortedTrailPoints(mockTrail);
        setCurrentPointIndex(0);
        setPlaybackPosition(0);
        
        // Set the current timestamp for interpolation
        if (mockTrail.length > 0) {
          setCurrentTargetTimestamp(new Date(mockTrail[0].timestamp).getTime());
        }
        
        // Auto-start playback after a short delay to allow state updates
        setTimeout(() => {
          console.log("Auto-starting playback with error-fallback mock data");
          startPlayback();
        }, 500);
      }
    } else {
      console.log(`Vehicle with ID ${deviceId} not found, using demo data`);
      
      // Create a placeholder vehicle since the real one wasn't found
      const mockVehicle: VehicleData = {
        deviceId: deviceId,
        vehicleNumber: "DEMO-" + deviceId.substring(0, 4),
        routeNumber: "DEMO",
        routeId: null,
        provider: "default",
        trail: []
      };
      
      // Set this as the animation vehicle
      setAnimationVehicle(mockVehicle);
      
      // Generate mock data for demo
      const mockTrail = Array.from({ length: 10 }, (_, i) => {
        return {
          lat: 12.9716 + (i * 0.0005),
          lng: 77.5946 + (i * 0.0005),
          timestamp: new Date(Date.now() - (9-i) * 5 * 60000).toISOString()
        };
      });
      
      setSortedTrailPoints(mockTrail);
      setCurrentPointIndex(0);
      setPlaybackPosition(0);
      
      // Set the current timestamp for interpolation
      if (mockTrail.length > 0) {
        setCurrentTargetTimestamp(new Date(mockTrail[0].timestamp).getTime());
      }
      
      // Auto-start playback after a short delay to allow state updates
      setTimeout(() => {
        console.log("Auto-starting playback with not-found mock data");
        startPlayback();
      }, 500);
    }
  };

  // Calculate total duration of the trail in milliseconds
  const calculateTrailDuration = useCallback(() => {
    if (sortedTrailPoints.length < 2) return 0;
    
    const startTime = new Date(sortedTrailPoints[0].timestamp).getTime();
    const endTime = new Date(sortedTrailPoints[sortedTrailPoints.length - 1].timestamp).getTime();
    
    return endTime - startTime;
  }, [sortedTrailPoints]);
  
  // Format playback time
  const formatPlaybackTime = useCallback((positionPercent: number) => {
    if (sortedTrailPoints.length < 2) return "00:00";
    
    const totalDuration = calculateTrailDuration();
    const currentMs = (positionPercent / 100) * totalDuration;
    
    // Convert to minutes and seconds
    const totalSeconds = Math.floor(currentMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [sortedTrailPoints, calculateTrailDuration]);
  
  // Improve playback to make it smooth and proportional to travel time
  const startPlayback = useCallback(() => {
    console.log("StartPlayback called with state:", {
      hasAnimationVehicle: !!animationVehicle,
      trailPointsLength: sortedTrailPoints.length,
      currentPointIndex
    });

    // First clear any existing animation
    if (animationRef.current !== null) {
      console.log("Canceling existing animation");
      clearInterval(animationRef.current);
      animationRef.current = null;
    }
    
    // Now check if we have valid data
    if (!animationVehicle || sortedTrailPoints.length < 2) {
      console.log("Cannot start playback: no valid data");
      return;
    }
    
    // If at the end, reset to beginning
    if (currentPointIndex >= sortedTrailPoints.length - 1) {
      console.log("Resetting playback to beginning");
      setCurrentPointIndex(0);
      setPlaybackPosition(0);
    }
    
    console.log(`Starting playback with ${sortedTrailPoints.length} points`);
    setIsPlaying(true);
    
    // Calculate total time range of the trail
    const firstTimestamp = new Date(sortedTrailPoints[0].timestamp).getTime();
    const lastTimestamp = new Date(sortedTrailPoints[sortedTrailPoints.length - 1].timestamp).getTime();
    const totalDurationMs = lastTimestamp - firstTimestamp;
    
    console.log(`Trail spans ${totalDurationMs / 1000} seconds real time`);
    
    // Find time gaps between points to identify jumps
    const timeGaps: number[] = [];
    let maxGapMs = 0;
    
    for (let i = 1; i < sortedTrailPoints.length; i++) {
      const prevTime = new Date(sortedTrailPoints[i-1].timestamp).getTime();
      const currTime = new Date(sortedTrailPoints[i].timestamp).getTime();
      const gap = currTime - prevTime;
      timeGaps.push(gap);
      maxGapMs = Math.max(maxGapMs, gap);
    }
    
    // Consider a gap significant if it's more than 1 minute
    const significantGapMs = 60000; 
    console.log(`Maximum time gap: ${maxGapMs / 1000} seconds`);
    
    // Start time of the animation
    const startTime = performance.now();
    let lastUpdateTime = startTime;
    
    // Update interval - aim for smooth animation at ~60fps but only update visuals when needed
    const interval = setInterval(() => {
      const currentTime = performance.now();
      const elapsedRealMs = currentTime - startTime;
      
      // Apply playback speed to get effective elapsed time
      const effectiveElapsedMs = elapsedRealMs * playbackSpeed;
      
      // Calculate progress through total duration (0-1)
      const rawProgress = Math.min(effectiveElapsedMs / (totalDurationMs / TIME_SCALE), 1);
      
      // Convert to target timestamp in the trail
      const targetTimestamp = firstTimestamp + (rawProgress * totalDurationMs);
      
      // Save the current target timestamp for interpolation
      setCurrentTargetTimestamp(targetTimestamp);
      
      // Find the points before and after this timestamp for interpolation
      let beforeIndex = 0;
      let afterIndex = 0;
      
      for (let i = 0; i < sortedTrailPoints.length - 1; i++) {
        const pointTime = new Date(sortedTrailPoints[i].timestamp).getTime();
        const nextPointTime = new Date(sortedTrailPoints[i+1].timestamp).getTime();
        
        if (pointTime <= targetTimestamp && nextPointTime >= targetTimestamp) {
          beforeIndex = i;
          afterIndex = i + 1;
          break;
        }
      }
      
      // If we've reached the end
      if (rawProgress >= 1) {
        console.log("Playback complete");
        setCurrentPointIndex(sortedTrailPoints.length - 1);
        setPlaybackPosition(100);
        setIsPlaying(false);
        clearInterval(animationRef.current!);
        animationRef.current = null;
        return;
      }
      
      // Calculate percentage through the playback
      const newPosition = rawProgress * 100;
      
      // Check if we should handle a significant time gap
      const timeGap = timeGaps[beforeIndex];
      const isSignificantGap = timeGap > significantGapMs;
      
      // Determine if we need to quickly jump ahead (for large time gaps)
      if (isSignificantGap) {
        console.log(`Significant time gap at index ${beforeIndex}: ${timeGap / 1000}s`);
        // Move to next point after the gap
        beforeIndex = afterIndex;
        afterIndex = Math.min(afterIndex + 1, sortedTrailPoints.length - 1);
      }
      
      // Calculate position between the two points based on timestamp
      if (beforeIndex !== afterIndex) {
        const beforeTime = new Date(sortedTrailPoints[beforeIndex].timestamp).getTime();
        const afterTime = new Date(sortedTrailPoints[afterIndex].timestamp).getTime();
        const segmentProgress = (targetTimestamp - beforeTime) / (afterTime - beforeTime);
        
        // Interpolate position between the two points
        const beforePoint = sortedTrailPoints[beforeIndex];
        const afterPoint = sortedTrailPoints[afterIndex];
        
        // Only update if we're at a new point
        if (currentPointIndex !== beforeIndex) {
          console.log(`Moving to point ${beforeIndex} (${segmentProgress.toFixed(2)} toward ${afterIndex})`);
          setCurrentPointIndex(beforeIndex);
          
          // Pan the map to the current point
          const map = (window as any).leafletMap;
          if (map) {
            map.panTo([beforePoint.lat, beforePoint.lng], { animate: true, duration: 0.5 });
          }
        }
      }
      
      // Update position indicator
      setPlaybackPosition(newPosition);
      
    }, 16); // ~60fps update rate
    
    // Store the interval ID for cleanup
    animationRef.current = interval as unknown as number;
  }, [animationVehicle, sortedTrailPoints, currentPointIndex, playbackSpeed, TIME_SCALE]);

  // Simplify stopPlayback as well
  const stopPlayback = useCallback(() => {
    console.log("Stopping playback");
    
    if (animationRef.current !== null) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }
    
    setIsPlaying(false);
  }, []);
  
  // Reset playback to beginning
  const resetPlayback = useCallback(() => {
    stopPlayback();
    setPlaybackPosition(0);
    setCurrentPointIndex(0);
  }, [stopPlayback]);
  
  // Toggle playback
  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, startPlayback, stopPlayback]);
  
  // Update handlePlaybackPositionChange to properly update the current point
  const handlePlaybackPositionChange = useCallback((event: Event, newValue: number | number[]) => {
    const position = newValue as number;
    stopPlayback();
    setPlaybackPosition(position);
    
    // Explicitly calculate the current point index
    if (sortedTrailPoints.length === 0) return;
    
    if (position <= 0) {
      setCurrentPointIndex(0);
      return;
    }
    
    if (position >= 100) {
      setCurrentPointIndex(sortedTrailPoints.length - 1);
      return;
    }
    
    const totalDuration = calculateTrailDuration();
    console.log("Total duration:", totalDuration);
    if (totalDuration === 0) {
      setCurrentPointIndex(0);
      return;
    }
    
    const currentTimePosition = (position / 100) * totalDuration;
    const startTime = new Date(sortedTrailPoints[0].timestamp).getTime();
    const targetTime = startTime + currentTimePosition;
    
    // Find the closest point based on time
    let closestIndex = 0;
    let closestDiff = Number.MAX_SAFE_INTEGER;
    
    sortedTrailPoints.forEach((point, index) => {
      const pointTime = new Date(point.timestamp).getTime();
      const diff = Math.abs(pointTime - targetTime);
      
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = index;
      }
    });
    
    console.log(`Slider adjusted: position ${position.toFixed(1)}%, index ${closestIndex}/${sortedTrailPoints.length-1}`);
    setCurrentPointIndex(closestIndex);
    
    // Pan the map to the selected point
    if (closestIndex >= 0 && closestIndex < sortedTrailPoints.length) {
      const currentPoint = sortedTrailPoints[closestIndex];
      const map = (window as any).leafletMap;
      if (map) {
        map.panTo([currentPoint.lat, currentPoint.lng], { animate: true, duration: 0.5 });
      }
    }
  }, [stopPlayback, sortedTrailPoints, calculateTrailDuration]);
  
  // Change playback speed
  const handleSpeedChange = useCallback(() => {
    // Cycle through speeds: 1x -> 2x -> 4x -> 1x
    setPlaybackSpeed(prevSpeed => {
      if (prevSpeed === 1) return 2;
      if (prevSpeed === 2) return 4;
      return 1;
    });
  }, []);
  
  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        clearInterval(animationRef.current);
      }
    };
  }, []);

  // Animated vehicle marker for playback
  const AnimatedVehicleMarker = useCallback(() => {
    if (!animationVehicle || sortedTrailPoints.length === 0 || currentPointIndex < 0) return null;
    
    const currentPoint = sortedTrailPoints[currentPointIndex];
    if (!currentPoint) return null;
    
    const isOffline = offlineVehicleIds.has(animationVehicle.deviceId);
    const vehicleColor = getVehicleColor(animationVehicle.provider);
    
    // Make the animated marker a bit larger and more visible
    const icon = L.divIcon({
      className: 'animated-vehicle-marker',
      html: `<div style="
        background-color: ${isOffline ? '#EA4335' : vehicleColor};
        border: 3px solid white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
      ">
      <div style="
        position: absolute;
        width: 40px;
        height: 4px;
        background-color: ${isOffline ? '#EA4335' : vehicleColor};
        opacity: 0.7;
        border-radius: 2px;
        transform: rotate(45deg);
        top: 8px;
        left: -10px;
      "></div>
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    
    return (
      <Marker
        position={[currentPoint.lat, currentPoint.lng]}
        icon={icon}
        zIndexOffset={1000} // Always on top
      >
        <Popup>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            {animationVehicle.vehicleNumber}
          </Typography>
          <Typography variant="body2">
            Time: {formatTimestamp(currentPoint.timestamp)}
          </Typography>
          <Typography variant="body2">
            Point {currentPointIndex + 1} of {sortedTrailPoints.length}
          </Typography>
        </Popup>
      </Marker>
    );
  }, [animationVehicle, sortedTrailPoints, currentPointIndex, offlineVehicleIds, getVehicleColor]);

  // Enhance TrailPath component to include interpolated position
  const TrailPath = ({ 
    trailPoints, 
    currentIndex,
    targetTimestamp = null
  }: { 
    trailPoints: Array<{lat: number, lng: number, timestamp: string}>, 
    currentIndex: number,
    targetTimestamp?: number | null
  }) => {
    // Don't render if we don't have enough points
    if (trailPoints.length < 2) return null;
    
    // Calculate interpolated position if targetTimestamp is provided
    let interpolatedPosition: [number, number] | null = null;
    
    if (targetTimestamp && currentIndex < trailPoints.length - 1) {
      const currentPoint = trailPoints[currentIndex];
      const nextPoint = trailPoints[currentIndex + 1];
      
      const currentTime = new Date(currentPoint.timestamp).getTime();
      const nextTime = new Date(nextPoint.timestamp).getTime();
      
      // Calculate progress between current and next point
      if (targetTimestamp >= currentTime && targetTimestamp <= nextTime) {
        const progress = (targetTimestamp - currentTime) / (nextTime - currentTime);
        
        // Interpolate lat/lng
        const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * progress;
        const lng = currentPoint.lng + (nextPoint.lng - currentPoint.lng) * progress;
        
        interpolatedPosition = [lat, lng];
      }
    }
    
    // Convert trail points to positions for Polyline
    const positions = trailPoints.map(point => [point.lat, point.lng]);
    const currentPositions = positions.slice(0, currentIndex + 1);
    const futurePositions = positions.slice(currentIndex);
    
    return (
      <>
        {/* Traveled path (solid, colored by provider) */}
        <Polyline
          positions={currentPositions as L.LatLngExpression[]}
          color="#4285F4"
          weight={5}
          opacity={0.8}
        />
        
        {/* Future path (dashed, gray) */}
        <Polyline
          positions={futurePositions as L.LatLngExpression[]}
          color="#757575"
          weight={3}
          opacity={0.5}
          dashArray="5, 10"
        />
        
        {/* Only show markers for important points to reduce clutter */}
        {trailPoints.map((point, index) => {
          // Only show markers for:
          // 1. Current point
          // 2. First and last points
          // 3. Every 5th point to reduce clutter
          const isImportantPoint = 
            index === currentIndex || 
            index === 0 || 
            index === trailPoints.length - 1 || 
            index % 5 === 0;
            
          if (!isImportantPoint) return null;
          
          return (
            <CircleMarker
              key={`point-${index}`}
              center={[point.lat, point.lng]}
              radius={index === currentIndex ? 6 : 4}
              color={index <= currentIndex ? "#4285F4" : "#757575"}
              fillColor={index <= currentIndex ? "#4285F4" : "#FFFFFF"}
              fillOpacity={0.8}
              weight={2}
            >
              <Tooltip direction="top" offset={[0, -5]} opacity={0.9}>
                <Typography variant="caption">
                  Point {index + 1}/{trailPoints.length}
                  <br />
                  {formatTimestamp(point.timestamp)}
                </Typography>
              </Tooltip>
            </CircleMarker>
          );
        })}
        
        {/* Show interpolated position if available */}
        {interpolatedPosition && (
          <CircleMarker
            center={interpolatedPosition}
            radius={8}
            color="#4285F4"
            fillColor="#FFFFFF"
            fillOpacity={1}
            weight={3}
          />
        )}
      </>
    );
  };

  // Update the renderMapContent to hide other vehicles during playback
  const renderMapContent = useCallback(() => {
    return (
      <>
        <MapController />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Show the animated trail path if a vehicle is selected for playback */}
        {animationVehicle && sortedTrailPoints.length > 0 && (
          <TrailPath 
            trailPoints={sortedTrailPoints}
            currentIndex={currentPointIndex}
            targetTimestamp={currentTargetTimestamp}
          />
        )}
        
        {/* If we're in playback mode, only show the selected vehicle */}
        {isPlaying && animationVehicle ? (
          // Only render the animated marker for the selected vehicle during playback
          <Marker
            position={[sortedTrailPoints[currentPointIndex].lat, sortedTrailPoints[currentPointIndex].lng]}
            icon={createAnimatedIcon(getVehicleColor(animationVehicle.provider), isPlaying)}
            zIndexOffset={1000}
          >
            <Popup>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                {animationVehicle.vehicleNumber}
              </Typography>
              <Typography variant="body2">
                Time: {formatTimestamp(sortedTrailPoints[currentPointIndex].timestamp)}
              </Typography>
              <Typography variant="body2">
                Point {currentPointIndex + 1} of {sortedTrailPoints.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Playback position: {playbackPosition.toFixed(1)}%
              </Typography>
            </Popup>
          </Marker>
        ) : (
          // If not in playback mode, show all vehicles
          vehicles.map(vehicle => (
            <React.Fragment key={vehicle.deviceId}>
              {/* When a vehicle is selected but not playing, hide other vehicles to focus on the selected one */}
              {(!selectedVehicle || selectedVehicle === vehicle.deviceId) && (
                <VehicleMarker vehicle={vehicle} />
              )}
              
              {/* Show animated marker if this is the playback vehicle but not playing */}
              {!isPlaying && animationVehicle?.deviceId === vehicle.deviceId && sortedTrailPoints.length > 0 && 
               currentPointIndex >= 0 && currentPointIndex < sortedTrailPoints.length && (
                <Marker
                  position={[sortedTrailPoints[currentPointIndex].lat, sortedTrailPoints[currentPointIndex].lng]}
                  icon={createAnimatedIcon(getVehicleColor(animationVehicle.provider), false)}
                  zIndexOffset={1000}
                >
                  <Popup>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      {animationVehicle.vehicleNumber}
                    </Typography>
                    <Typography variant="body2">
                      Time: {formatTimestamp(sortedTrailPoints[currentPointIndex].timestamp)}
                    </Typography>
                    <Typography variant="body2">
                      Point {currentPointIndex + 1} of {sortedTrailPoints.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Click play to start animation
                    </Typography>
                  </Popup>
                </Marker>
              )}
            </React.Fragment>
          ))
        )}
      </>
    );
  }, [vehicles, animationVehicle, sortedTrailPoints, currentPointIndex, currentTargetTimestamp, 
      playbackPosition, isPlaying, selectedVehicle, getVehicleColor, formatTimestamp]);

  // Helper function to create an animated icon
  const createAnimatedIcon = (color: string, isPlaying: boolean): L.DivIcon => {
    return L.divIcon({
      className: 'animated-vehicle-marker',
      html: `<div style="
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        width: 26px;
        height: 26px;
        box-shadow: 0 0 10px rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
        ${isPlaying ? 'animation: pulse 1.5s infinite;' : ''}
      ">
      <div style="
        position: absolute;
        width: 40px;
        height: 6px;
        background-color: ${color};
        opacity: 0.8;
        border-radius: 3px;
        transform: rotate(45deg);
        top: 10px;
        left: -10px;
      "></div>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
      </style>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  };

  // Update the handle focus function to start focused refreshes
  const handleVehicleFocus = useCallback((deviceId: string) => {
    setFocusedVehicle(deviceId);
    setSelectedVehicle(deviceId);
    
    // Find the vehicle and center the map on it
    const vehicle = vehicles.find(v => v.deviceId === deviceId);
    if (vehicle && vehicle.trail.length > 0) {
      // Use the global map instance
      const map = (window as any).leafletMap;
      if (map) {
        map.setView(
          [vehicle.trail[0].lat, vehicle.trail[0].lng],
          15, // Zoom level
          { animate: true }
        );
      }
    }
    
    // Clear any existing focused bus refresh interval
    if (focusedBusRefreshInterval) {
      clearInterval(focusedBusRefreshInterval);
      setFocusedBusRefreshInterval(null);
    }
    
    // Set up a new refresh interval for this focused bus
    const intervalId = setInterval(() => {
      // Only refresh if still the same focused bus and not user interacting with time
      if (focusedVehicle === deviceId && !isUserInteracting) {
        fetchFocusedVehicle(deviceId);
      }
    }, FOCUSED_BUS_REFRESH_INTERVAL);
    
    setFocusedBusRefreshInterval(intervalId);
    
    // Do an immediate fetch for the latest data
    fetchFocusedVehicle(deviceId);
  }, [vehicles, focusedVehicle, isUserInteracting, focusedBusRefreshInterval, fetchFocusedVehicle]);

  // Update the clear focus function to stop focused refreshes
  const clearFocus = useCallback(() => {
    setFocusedVehicle(null);
    
    // Clear focused bus refresh interval
    if (focusedBusRefreshInterval) {
      clearInterval(focusedBusRefreshInterval);
      setFocusedBusRefreshInterval(null);
    }
  }, [focusedBusRefreshInterval]);

  // Handle Active Buses Card click to show bus table
  const handleActiveBusesClick = () => {
    setShowBusesTable(prev => !prev);
    setShowRoutesTable(false);
  };
  
  // Handle Routes click to show routes table
  const handleRoutesClick = () => {
    setShowRoutesTable(prev => !prev);
    setShowBusesTable(false);
  };
  
  // Handle selecting a specific route
  const handleRouteSelect = (route: string | null) => {
    setSelectedRoute(route);
    
    if (route) {
      const filtered = vehicles.filter(vehicle => 
        vehicle.routeId === route || vehicle.routeNumber === route
      );
      setFilteredVehicles(filtered);
      setShowBusesTable(true);
      setShowRoutesTable(false);
    } else {
      setFilteredVehicles([]);
    }
  };

  // Clear selected route
  const handleClearRouteSelect = () => {
    setSelectedRoute(null);
    setFilteredVehicles([]);
  };
  
  // Handle searching for a specific route
  const handleRouteSearch = (route: string) => {
    // Check if the route exists in the available routes
    if (!route || route.trim() === '') {
      return;
    }
    
    const normalizedRoute = route.trim().toLowerCase();
    const routeExists = availableRoutes.some(r => 
      r.toLowerCase() === normalizedRoute
    );
    
    if (routeExists) {
      // Find the exact case-sensitive route
      const exactRoute = availableRoutes.find(r => 
        r.toLowerCase() === normalizedRoute
      );
      
      if (exactRoute) {
        handleRouteSelect(exactRoute);
      }
    } else {
      // Show error if route not found
      setRouteError(`Route "${route}" not found`);
      setShowError(true);
    }
  };
  
  // Handle searching for a specific vehicle by number
  const handleVehicleSearch = (vehicleNumber: string) => {
    if (!vehicleNumber || vehicleNumber.trim() === '') {
      return;
    }
    
    const normalizedVehicleNumber = vehicleNumber.trim().toUpperCase();
    const vehicle = vehicles.find(v => 
      v.vehicleNumber && v.vehicleNumber.toUpperCase() === normalizedVehicleNumber
    );
    
    if (vehicle) {
      // Found the vehicle, focus on it
      handleVehicleFocus(vehicle.deviceId);
      setSearchVehicle(''); // Clear search after finding
    } else {
      // Show error if vehicle not found
      setVehicleError(`Vehicle "${vehicleNumber}" not found`);
      setShowError(true);
    }
  };
  
  // Handle closing the error toast
  const handleCloseError = () => {
    setShowError(false);
    setRouteError(null);
    setVehicleError(null);
  };

  // Generate mock trail points function
  const generateMockTrailPoints = (basePoint: TrailPoint, count: number) => {
    console.log("Using mock trail data for demo");
    // Generate mock trail points around the current position
    const mockTrail = Array.from({ length: count }, (_, i) => {
      // Create points in a small path pattern
      return {
        lat: Number(basePoint.lat) + (i * 0.0005),
        lng: Number(basePoint.lng) + (i * 0.0005),
        timestamp: new Date(Date.now() - (count-1-i) * 5 * 60000).toISOString()
      };
    });
    
    console.log(`Generated ${mockTrail.length} mock trail points`);
    setSortedTrailPoints(mockTrail);
    setCurrentPointIndex(0);
    setPlaybackPosition(0);
  };

  // Add the MAP_CONTAINER_PROPS constant near other constants
  // Add this near line ~105 after the TIME_SCALE constant
  // Use for map container configuration
  const MAP_CONTAINER_PROPS = {
    center: [13.0022, 77.5800] as [number, number],
    zoom: 12,
    scrollWheelZoom: true,
    style: { height: "100%", width: "100%" }
  };

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <CssBaseline />
        <div className="app-container">
          {/* Map Container - moved first in the DOM for proper rendering */}
          <div className="map-container">
            {isLoading ? (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                <CircularProgress />
              </Box>
            ) : null}
            
            {error && (
              <Alert severity="error" sx={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 1000 }}>
                {error}
              </Alert>
            )}
            
            <MapContainer
              {...MAP_CONTAINER_PROPS}
              ref={(mapInstance) => {
                if (mapInstance) {
                  // Store the map globally to access it from elsewhere
                  (window as any).leafletMap = mapInstance;
                }
              }}
            >
              {renderMapContent()}
            </MapContainer>
            
            {/* Playback controls - only show when a vehicle is selected */}
            {selectedVehicle && animationVehicle && (
              <PlaybackControls
                selectedVehicle={selectedVehicle}
                animationVehicle={animationVehicle}
                sortedTrailPoints={sortedTrailPoints}
                playbackPosition={playbackPosition}
                currentPointIndex={currentPointIndex}
                isPlaying={isPlaying}
                playbackSpeed={playbackSpeed}
                onPlaybackPositionChange={handlePlaybackPositionChange}
                onTogglePlayback={togglePlayback}
                onResetPlayback={resetPlayback}
                onSpeedChange={handleSpeedChange}
                onClearSelection={() => setSelectedVehicle(null)}
                formatPlaybackTime={formatPlaybackTime}
                generateMockTrailPoints={generateMockTrailPoints}
              />
            )}
            
            {/* Time Range Control Panel */}
            <Paper 
              elevation={3} 
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                zIndex: 1000,
                width: 300,
                p: 2,
                borderRadius: 3,
                maxHeight: 'calc(100vh - 32px)',
                overflowY: 'auto'
              }}
            >
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
                Bus Tracking Dashboard
              </Typography>
              
              <Divider sx={{ mb: 2 }} />
              
              {/* Stats Section */}
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Live Analytics</span>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                Past {timeWindowMinutes} minutes
              </Typography>
            </Typography>
            
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {/* Active Buses */}
              <Grid item xs={6}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    background: 'linear-gradient(45deg, #34A853 30%, #4CAF50 90%)',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.03)'
                    }
                  }}
                  onClick={handleActiveBusesClick}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <DirectionsBusIcon sx={{ mr: 1, fontSize: 20 }} />
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        Active Buses
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {vehicles.length}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '9px', opacity: 0.9 }}>
                      Within selected time range
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Offline Buses */}
              <Grid item xs={6}>
                <Card sx={{ 
                  height: '100%', 
                  background: 'linear-gradient(45deg, #EA4335 30%, #F44336 90%)',
                  color: 'white'
                }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <SignalWifiOffIcon sx={{ mr: 1, fontSize: 20 }} />
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        Offline Buses
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {offlineVehicles}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '9px', opacity: 0.9 }}>
                      Active in past hour, offline in past 5 min
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Vehicle Search */}
              <Grid item xs={12} sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                  Find a Specific Bus
                </Typography>
                <Autocomplete
                  freeSolo
                  size="small"
                  options={vehicles.map(v => v.vehicleNumber)}
                  value={searchVehicle}
                  onChange={(_, newValue) => {
                    if (newValue) {
                      handleVehicleSearch(newValue);
                    }
                  }}
                  onInputChange={(_, newInputValue) => {
                    setSearchVehicle(newInputValue);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search Vehicle Number"
                      variant="outlined"
                      fullWidth
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {params.InputProps.endAdornment}
                            <IconButton 
                              size="small" 
                              onClick={() => handleVehicleSearch(searchVehicle)}
                            >
                              <DirectionsBusIcon fontSize="small" />
                            </IconButton>
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              
              {/* Routes Card */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    background: 'linear-gradient(45deg, #4285F4 30%, #42A5F5 90%)',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.03)'
                    }
                  }}
                  onClick={handleRoutesClick}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <DirectionsIcon sx={{ mr: 1, fontSize: 20 }} />
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          Routes in Time Range
                        </Typography>
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {availableRoutes.length}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontSize: '9px', opacity: 0.9 }}>
                      Click to view routes available during selected hour
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Route Search */}
              <Grid item xs={12} sx={{ mt: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                  Find Buses by Route
                </Typography>
                <Autocomplete
                  freeSolo
                  size="small"
                  options={availableRoutes}
                  value={searchRoute}
                  onChange={(_, newValue) => {
                    if (newValue) {
                      handleRouteSearch(newValue);
                    }
                  }}
                  onInputChange={(_, newInputValue) => {
                    setSearchRoute(newInputValue);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search Route"
                      variant="outlined"
                      fullWidth
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {params.InputProps.endAdornment}
                            <IconButton 
                              size="small" 
                              onClick={() => handleRouteSearch(searchRoute)}
                            >
                              <DirectionsIcon fontSize="small" />
                            </IconButton>
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
            </Grid>
            
            {/* Coverage Section */}
            <Typography variant="subtitle2" sx={{ mb: 1, mt: 3, color: 'text.secondary' }}>
              Provider Fleet Coverage (24h)
            </Typography>

            {dailyCoverage ? (
              <>
                {/* Provider-wise daily coverage */}
                {dailyCoverage.providerCoverage.map(providerData => (
                  <Box key={providerData.provider} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ 
                          textTransform: 'capitalize',
                          fontWeight: 'medium'
                        }}>
                          {providerData.provider === 'amnex' ? 'Amnex' : 
                           providerData.provider === 'chalo' ? 'Chalo' : 
                           providerData.provider}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {providerData.coverage.toFixed(1)}% of {totalFleetSize}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={providerData.coverage} 
                        sx={{ 
                          flexGrow: 1,
                          mr: 1,
                          height: 6, 
                          borderRadius: 3,
                          backgroundColor: 'rgba(0,0,0,0.05)',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: PROVIDER_COLORS[providerData.provider.toLowerCase()] || PROVIDER_COLORS.default
                          }
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {providerData.deviceCount} buses
                      </Typography>
                    </Box>
                  </Box>
                ))}
                
                <Typography variant="caption" sx={{ display: 'block', mt: 0, mb: 2, color: 'text.secondary', fontSize: '10px' }}>
                  Last updated: {new Date(dailyCoverage.timestamp).toLocaleString()}
                </Typography>
              </>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 3 }}>
                {coverageLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Provider coverage data unavailable
                  </Typography>
                )}
              </Box>
            )}
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              Time Selection
            </Typography>
            
            <Box sx={{ mb: 3, px: 1 }}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateTimePicker
                  label="Select Date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  slotProps={{ 
                    textField: { fullWidth: true, size: "small", sx: { mb: 2 } },
                    actionBar: { actions: ['clear', 'today'] }
                  }}
                  maxDate={new Date()} // Prevent selection of future dates
                  views={['year', 'month', 'day']}
                />
              </LocalizationProvider>
              
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary', display: 'flex', justifyContent: 'space-between' }}>
                <span>Hour of day:</span>
                <span>{formatHour(selectedHour)}</span>
              </Typography>
              
              <Slider
                value={selectedHour}
                onChange={handleHourChange}
                aria-labelledby="hour-slider"
                valueLabelDisplay="auto"
                valueLabelFormat={formatHour}
                step={1}
                marks={[
                  { value: 0, label: '12 AM' },
                  { value: 6, label: '6 AM' },
                  { value: 12, label: '12 PM' },
                  { value: 18, label: '6 PM' },
                  { value: 23, label: '11 PM' }
                ]}
                min={0}
                max={23}
                disabled={isLoading}
                sx={{ 
                  '& .MuiSlider-markLabel': {
                    fontSize: '0.7rem'
                  }
                }}
              />
              
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                Showing data from {formatHour(selectedHour)} to {formatHour((selectedHour + 1) % 24)} on {selectedDate.toLocaleDateString()} (IST)
              </Typography>
            </Box>
            
            <Button 
              variant="contained" 
              onClick={fetchVehicles}
              fullWidth
              startIcon={<RefreshIcon />}
              disabled={loading}
              sx={{ mb: 2 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Refresh Data'}
            </Button>
            
            <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
              {selectedVehicle ? 
                `Selected Vehicle: ${selectedVehicle}`
                : 'No vehicle selected'}
            </Typography>
          </Paper>

          {/* Focus indicator and clear button - when vehicle is focused */}
          {focusedVehicle && (
            <Paper
              elevation={3}
              sx={{
                position: 'absolute',
                top: 16,
                left: 16,
                zIndex: 1000,
                p: 1.5,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.95)'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                <DirectionsBusIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  {vehicles.find(v => v.deviceId === focusedVehicle)?.vehicleNumber || 'Unknown Vehicle'}
                </Typography>
              </Box>
              <Button 
                size="small" 
                variant="outlined" 
                onClick={clearFocus}
                startIcon={<ClearIcon />}
                sx={{ ml: 2 }}
              >
                Show All
              </Button>
            </Paper>
          )}
          
          {/* Active Buses Table Dialog */}
          <Dialog 
            open={showBusesTable} 
            onClose={() => setShowBusesTable(false)}
            maxWidth="lg"
            fullWidth
          >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <DirectionsBusIcon sx={{ mr: 1, color: 'primary.main' }} />
                {selectedRoute ? (
                  <Typography variant="h6">
                    Buses on Route {selectedRoute}
                  </Typography>
                ) : (
                  <Typography variant="h6">
                    All Active Buses
                  </Typography>
                )}
              </Box>
              <IconButton onClick={() => setShowBusesTable(false)}>
                <ClearIcon />
              </IconButton>
            </DialogTitle>
            
            <DialogContent>
              {selectedRoute && (
                <Box sx={{ mb: 2 }}>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={handleClearRouteSelect}
                    startIcon={<ClearIcon />}
                  >
                    Clear Route Filter
                  </Button>
                </Box>
              )}
              
              <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Vehicle Number</TableCell>
                      <TableCell>Device ID</TableCell>
                      <TableCell>Route Number</TableCell>
                      <TableCell>Route ID</TableCell>
                      <TableCell>Provider</TableCell>
                      <TableCell>Last Updated</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedRoute ? filteredVehicles : vehicles).map((vehicle) => (
                      <TableRow key={vehicle.deviceId}>
                        <TableCell>{vehicle.vehicleNumber || 'Unknown'}</TableCell>
                        <TableCell>{vehicle.deviceId}</TableCell>
                        <TableCell>{vehicle.routeNumber || 'N/A'}</TableCell>
                        <TableCell>{vehicle.routeId || 'N/A'}</TableCell>
                        <TableCell>{vehicle.provider || 'Unknown'}</TableCell>
                        <TableCell>
                          {vehicle.trail.length > 0 
                            ? new Date(vehicle.trail[0].timestamp).toLocaleString() 
                            : 'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          {offlineVehicleIds.has(vehicle.deviceId) ? (
                            <Chip label="Offline" size="small" color="error" />
                          ) : (
                            <Chip label="Active" size="small" color="success" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="small" 
                            variant="contained" 
                            onClick={() => {
                              setShowBusesTable(false);
                              handleVehicleFocus(vehicle.deviceId);
                              handleVehicleSelect(vehicle.deviceId); // Add this line to trigger playback
                            }}
                          >
                            View on Map
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </DialogContent>
          </Dialog>
          
          {/* Routes Table Dialog */}
          <Dialog 
            open={showRoutesTable} 
            onClose={() => setShowRoutesTable(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <DirectionsIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">
                  Routes in Selected Time Range
                </Typography>
              </Box>
              <IconButton onClick={() => setShowRoutesTable(false)}>
                <ClearIcon />
              </IconButton>
            </DialogTitle>
            
            <DialogContent>
              <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Route ID/Number</TableCell>
                      <TableCell align="center">Active Buses</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {availableRoutes.map(route => {
                      const busesOnRoute = vehicles.filter(vehicle => 
                        vehicle.routeId === route || vehicle.routeNumber === route
                      );
                      
                      return (
                        <TableRow key={route}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              {route}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={busesOnRoute.length} color="primary" />
                          </TableCell>
                          <TableCell align="center">
                            <Button 
                              variant="contained" 
                              size="small" 
                              onClick={() => handleRouteSelect(route)}
                            >
                              View Buses
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </DialogContent>
          </Dialog>

          {/* Error Snackbar for route not found or vehicle not found */}
          <Snackbar
            open={showError}
            autoHideDuration={4000}
            onClose={handleCloseError}
            message={routeError || vehicleError}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert 
              onClose={handleCloseError} 
              severity="error" 
              sx={{ width: '100%' }}
            >
              {routeError || vehicleError}
            </Alert>
          </Snackbar>
        </div>
        </div>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;