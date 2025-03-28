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

// Access runtime environment variables from window.ENV
declare global {
  interface Window {
    ENV: {
      VITE_BASE_URL: string;
      VITE_API_URL: string;
    }
  }
}

// Constants
const API_BASE_URL = 'https://api.moving.tech/tracking';
const DEFAULT_MAP_CENTER = { lat: 12.9716, lng: 77.5946 }; // Default fallback if no vehicles
const MAX_POINT_DISTANCE_KM = 0.5; // Maximum distance in km between consecutive points in a trail
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes refresh interval for general data
const DEFAULT_TIME_RANGE = 60; // Default time range in minutes
const FOCUSED_BUS_REFRESH_INTERVAL = 10 * 1000; // 10 seconds refresh interval for focused bus
console.log("API_BASE_URL", API_BASE_URL)
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

// Create a debounce function with cancel method
function createDebouncedFunction<F extends (...args: any[]) => any>(
  func: F,
  waitFor: number
): {
  (...args: Parameters<F>): void;
  cancel: () => void;
} {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debouncedFunction = (...args: Parameters<F>): void => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  debouncedFunction.cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debouncedFunction;
}

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

// Format timestamp for display
const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short'
  });
};

// Add new types for the coverage data
interface ProviderCoverage {
  name: string;
  totalVehicles: number;
  coverage: number; // percentage of total fleet
}

interface DailyCoverage {
  totalVehicles: number;
  providers: ProviderCoverage[];
  timestamp?: string;
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
  // Map center state with a dedicated function to calculate it
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(DEFAULT_MAP_CENTER);
  
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
  const [focusedVehicle, setFocusedVehicle] = useState<VehicleData | null>(null);
  const [isFollowingFocused, setIsFollowingFocused] = useState<boolean>(false);
  
  // Search inputs
  const [searchInput, setSearchInput] = useState<string>('');
  
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
  
  // Constants for refresh intervals
  

  // Add this type for the refresh interval
  type TimeoutType = ReturnType<typeof setTimeout>;

  // Update the refresh interval state to use useRef instead of useState
  const focusedBusRefreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get color based on provider
  const getVehicleColor = (provider: string | null): string => {
    if (!provider) return PROVIDER_COLORS.default;
    
    const lowerProvider = provider.toLowerCase();
    return PROVIDER_COLORS[lowerProvider] || PROVIDER_COLORS.default;
  };

  // Function to calculate the map center based on vehicles
  const calculateMapCenter = useCallback(() => {
    // If we're focused on a vehicle, keep the center on it
    if (focusedVehicle && focusedVehicle.trail && focusedVehicle.trail.length > 0 && isFollowingFocused) {
      return { lat: focusedVehicle.trail[0].lat, lng: focusedVehicle.trail[0].lng };
    }
    
    // If we have vehicles, calculate the average position
    if (vehicles.length > 0) {
      const vehiclesWithTrail = vehicles.filter(v => v.trail && v.trail.length > 0);
      
      if (vehiclesWithTrail.length > 0) {
        // Calculate average position from first points of each vehicle trail
        const sum = vehiclesWithTrail.reduce(
          (acc, vehicle) => {
            if (vehicle.trail && vehicle.trail.length > 0) {
              acc.lat += vehicle.trail[0].lat;
              acc.lng += vehicle.trail[0].lng;
              acc.count += 1;
            }
            return acc;
          },
          { lat: 0, lng: 0, count: 0 }
        );
        
        if (sum.count > 0) {
          return { lat: sum.lat / sum.count, lng: sum.lng / sum.count };
        }
      }
    }
    
    // Default center if no vehicles or focused vehicle
    return DEFAULT_MAP_CENTER;
  }, [vehicles, focusedVehicle, isFollowingFocused]);

  // Function to convert local time to IST (for backend query)
  const convertToIST = (date: Date): Date => {
    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    return new Date(date.getTime() + istOffset - 60000);
  };

  // Format a date to IST string format matching backend
  const formatDateToIST = (date: Date): string => {
    const istDate = convertToIST(date);
    console.log("istDate", istDate)
    return istDate.toISOString().replace('T', ' ').split('.')[0];
  };

  // Function to check if a date is in the future
  const isFutureDate = (date: Date): boolean => {
    const now = new Date();
    return date > now;
  };
  
  // Function to check if two dates are the same day
  const isSameDay = (date1: Date, date2: Date): boolean => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
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
  // All timestamps are sent to the backend in IST format (UTC+5:30)
  const fetchVehicles = async () => {
    try {
      setLoading(true);
      
      // Calculate time range using selected date and hour - always use full hour boundaries
      const start = new Date(selectedDate);
      start.setHours(selectedHour);
      start.setMinutes(0);
      start.setSeconds(0);
      start.setMilliseconds(0);
      
      const end = new Date(selectedDate);
      end.setHours(selectedHour + 1);
      end.setMinutes(0);
      end.setSeconds(0);
      end.setMilliseconds(0);
      
      // Convert to IST for backend queries
      const istStart = convertToIST(start);
      const istEnd = convertToIST(end);
      
      // Format dates as strings in IST format for the backend
      const istStartFormatted = formatDateToIST(start);
      const istEndFormatted = formatDateToIST(end);
      
      console.log('Fetching vehicles with time range:', { 
        local: { start, end, hour: selectedHour },
        ist: { start: istStart, end: istEnd },
        istFormatted: { start: istStartFormatted, end: istEndFormatted }
      });
      
      const response = await axios.get<VehicleData[]>(`${API_BASE_URL}/api/vehicles`, {
        params: {
          startTime: istStartFormatted, // Use IST formatted string
          endTime: istEndFormatted,     // Use IST formatted string
          includeTrail: true            // Explicitly request trail data
        }
      });
      
      console.log('Received vehicles data:', response.data.length, 'vehicles');
      
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
      
      // Update all state in one batch using the processed data
      setVehicles(prevVehicles => processVehiclesData(prevVehicles, vehiclesData));
      
      // Turn off loading state
      setLoading(false);
      setIsLoading(false);
      setError(null);
      
      // Auto-pan to loaded vehicles if enabled and not focused on a specific vehicle
      if (shouldAutoPanMap && !focusedVehicle) {
        setTimeout(() => {
          // Get map instance
          const map = (window as any).leafletMap;
          if (!map) return;
          
          console.log('Auto-panning map to show loaded vehicles');
          
          // If we only have one vehicle, center on it with a closer zoom
          if (vehiclesData.length === 1 && vehiclesData[0].trail && vehiclesData[0].trail.length > 0) {
            const vehicle = vehiclesData[0];
            const position = [vehicle.trail[0].lat, vehicle.trail[0].lng];
            map.setView(position, 15, { animate: true, duration: 1 });
            return;
          }
          
          // For multiple vehicles, create bounds to fit them all
          try {
            // Only include vehicles with trail data
            const vehiclesWithTrail = vehiclesData.filter(v => v.trail && v.trail.length > 0);
            
            if (vehiclesWithTrail.length === 0) return;
            
            // Create a bounds object to contain all points
            const bounds = L.latLngBounds([]);
            
            // Add all vehicle positions to the bounds
            vehiclesWithTrail.forEach(vehicle => {
              if (vehicle.trail && vehicle.trail.length > 0) {
                bounds.extend([vehicle.trail[0].lat, vehicle.trail[0].lng]);
              }
            });
            
            // If bounds are valid (has points), fit the map to these bounds
            if (bounds.isValid()) {
              map.fitBounds(bounds, { 
                padding: [50, 50], // Add padding around the bounds
                maxZoom: 15,       // Don't zoom in too much
                animate: true,
                duration: 1
              });
            }
          } catch (error) {
            console.error('Error auto-panning map:', error);
          }
          
          // Reset the flag after panning
          setShouldAutoPanMap(false);
        }, 200); // Slight delay to allow DOM to update
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      setLoading(false);
      setIsLoading(false);
    }
  };
  
  // Optimize the fetchDailyCoverage function to reduce API calls
  // Uses IST date (UTC+5:30) format for backend compatibility
  const fetchDailyCoverage = async () => {
    try {
      console.log('Fetching daily coverage');
      
      // Format the selected date in IST
      const istDateFormatted = formatDateToIST(new Date(selectedDate)).split(' ')[0]; // Get just the date part
      
      console.log('Using IST formatted date for coverage request:', istDateFormatted);
      
      const response = await axios.get(`${API_BASE_URL}/api/coverage/daily`, {
        params: {
          date: istDateFormatted
        }
      });
      
      console.log('Received daily coverage data:', response.data);
      
      // Check if response data exists
      if (!response.data) {
        console.error('Empty response from coverage API');
        return;
      }
      
      // Backend returns a different format than expected
      // Handling both possible response formats
      let providers: ProviderCoverage[] = [];
      let totalVehicles = 0;
      
      if (Array.isArray(response.data)) {
        // Old format - array of provider objects
        providers = response.data.map((item: any) => ({
          name: item.provider || 'unknown',
          totalVehicles: item.busesActive || 0,
          coverage: totalFleetSize > 0 ? ((item.busesActive || 0) / totalFleetSize) * 100 : 0
        }));
        
        // Calculate total vehicles
        totalVehicles = providers.reduce((sum: number, item: ProviderCoverage) => sum + item.totalVehicles, 0);
        
        // Set fleet size if available
        if (response.data.length > 0 && response.data[0].totalFleetSize) {
          setTotalFleetSize(response.data[0].totalFleetSize);
        }
      } else {
        // New format - object with providerCoverage array
        if (response.data.totalDevices) {
          setTotalFleetSize(response.data.totalDevices);
        }
        
        if (Array.isArray(response.data.providerCoverage)) {
          providers = response.data.providerCoverage.map((item: any) => ({
            name: item.provider || 'unknown',
            totalVehicles: item.deviceCount || 0,
            coverage: item.coverage || 0
          }));
          
          // Calculate total from providers if not provided
          totalVehicles = providers.reduce((sum: number, item: ProviderCoverage) => sum + item.totalVehicles, 0);
        }
      }
      
      // Convert response to match the DailyCoverage interface
      const coverageData: DailyCoverage = {
        totalVehicles,
        providers,
        timestamp: new Date().toISOString()
      };
      
      setDailyCoverage(coverageData);
    } catch (error) {
      console.error('Error fetching daily coverage:', error);
    }
  };
  
  // Function to fetch data for a specific focused vehicle
  // Uses IST time format (UTC+5:30) for backend query consistency
  const fetchFocusedVehicle = async () => {
    if (!focusedVehicle) return;
    
    try {
      // Calculate time range using selected date and hour - always use full hour boundaries
      const start = new Date(selectedDate);
      start.setHours(selectedHour);
      start.setMinutes(0);
      start.setSeconds(0);
      
      const end = new Date(selectedDate);
      end.setHours(selectedHour + 1);
      end.setMinutes(0);
      end.setSeconds(0);
      
      // Format dates in IST for backend queries
      const istStartFormatted = formatDateToIST(start);
      const istEndFormatted = formatDateToIST(end);
      
      console.log('Fetching focused vehicle data:', { 
        vehicleId: focusedVehicle.deviceId,
        startTime: istStartFormatted,
        endTime: istEndFormatted
      });
      
      const response = await axios.get<VehicleData[]>(`${API_BASE_URL}/api/vehicles`, {
        params: {
          deviceId: focusedVehicle.deviceId,
          startTime: istStartFormatted,
          endTime: istEndFormatted,
          includeTrail: true
        }
      });
      
      if (response.data.length > 0) {
        // Update the focused vehicle with fresh data
        setFocusedVehicle(response.data[0]);
        
        // If we're following the focused vehicle, update the map center
        if (isFollowingFocused && response.data[0].trail && response.data[0].trail.length > 0) {
          setMapCenter({ 
            lat: response.data[0].trail[0].lat, 
            lng: response.data[0].trail[0].lng 
          })
        }
      }
    } catch (error) {
      console.error('Error fetching focused vehicle data:', error);
    }
  };
  
  // Combined function to fetch data - replaces separate offline vehicle function
  const fetchAllData = useCallback(async () => {
    if (isUserInteracting) return; // Skip fetching if user is interacting with time inputs
    
    try {
      // Run these in parallel with Promise.all to improve performance
      await Promise.all([
        fetchVehicles(),
        fetchDailyCoverage()
      ]);
    } catch (error) {
      console.error('Error in fetch all data:', error);
    }
  }, [isUserInteracting]);

  // Update the handle focus function to start focused refreshes
  const handleVehicleFocus = (vehicle: VehicleData | string) => {
    if (typeof vehicle === 'string') {
      // If a device ID string is passed
      const foundVehicle = vehicles.find(v => v.deviceId === vehicle);
      if (foundVehicle) {
        setFocusedVehicle(foundVehicle);
        // Use the proper mapCenter type format
        setMapCenter({ 
          lat: foundVehicle.trail[0]?.lat || DEFAULT_MAP_CENTER.lat, 
          lng: foundVehicle.trail[0]?.lng || DEFAULT_MAP_CENTER.lng 
        });
      }
    } else {
      // If a VehicleData object is passed
      setFocusedVehicle(vehicle);
      // Use the proper mapCenter type format
      setMapCenter({ 
        lat: vehicle.trail[0]?.lat || DEFAULT_MAP_CENTER.lat, 
        lng: vehicle.trail[0]?.lng || DEFAULT_MAP_CENTER.lng 
      });
    }

    // Set up an interval to refresh the focused vehicle data
    if (focusedBusRefreshInterval.current) {
      clearInterval(focusedBusRefreshInterval.current);
    }
    
    focusedBusRefreshInterval.current = setInterval(() => {
      if (focusedVehicle && !isSliderMoving) {
        fetchFocusedVehicle();
      }
    }, 10000); // Refresh every 10 seconds
  };

  // Create debounced version of fetchAllData for time changes with cancel method
  const debouncedFetchData = useMemo(
    () => createDebouncedFunction(() => {
      setIsUserInteracting(false);
      fetchAllData();
    }, 800),
    [fetchAllData]
  );
  
  // UseEffect for time selection changes
  useEffect(() => {
    console.log('Time selection changed:', { selectedDate, selectedHour });
    console.log(selectedDate, selectedHour, debouncedFetchData, isPlaying);
    
    // User is now interacting with time controls
    setIsUserInteracting(true);
    
    // Stop any ongoing playback
    if (isPlaying) {
      stopPlayback();
    }
    
    // Trigger the debounced fetch after a delay
    debouncedFetchData();
    
    // Clean up
    return () => debouncedFetchData.cancel();
  }, [selectedDate, selectedHour, isPlaying]);
  
  // Create debounced search handler with cancel method
  const debouncedSearch = useMemo(
    () => createDebouncedFunction((searchTerm: string) => {
      console.log('Searching for vehicle:', searchTerm);
      if (searchTerm) {
        const matchedVehicles = vehicles.filter(vehicle => 
          vehicle.vehicleNumber?.toUpperCase().includes(searchTerm) ||
          vehicle.routeNumber?.toUpperCase().includes(searchTerm)
        );
        
        console.log(`Found ${matchedVehicles.length} matching vehicles`);
        setFilteredVehicles(matchedVehicles);
        
        // If we find exactly one match, focus on it
        if (matchedVehicles.length === 1) {
          handleVehicleFocus(matchedVehicles[0]);
        }
      } else {
        // If search is cleared and a route is selected, show vehicles for that route
        if (selectedRoute) {
          const routeVehicles = vehicles.filter(v => 
            v.routeId === selectedRoute || v.routeNumber === selectedRoute
          );
          setFilteredVehicles(routeVehicles);
        } else {
          // No search term and no route - show all vehicles
          setFilteredVehicles([]);
        }
      }
    }, 400),
    [vehicles, selectedRoute]
  );
  
  // Optimize vehicle search with debounce
  const handleSearchInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const searchTerm = event.target.value.trim().toUpperCase();
    setSearchInput(searchTerm);
  }, []);
  
  // Update clear focus function
  const clearVehicleFocus = useCallback(() => {
    setFocusedVehicle(null);
    setIsFollowingFocused(false);
    
    // Clear any existing refresh interval
    if (focusedBusRefreshInterval.current) {
      clearInterval(focusedBusRefreshInterval.current);
    }
  }, [focusedBusRefreshInterval]);
  
  // Function to stop playback
  const stopPlayback = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    setIsPlaying(false);
    setCurrentTargetTimestamp(null);
    setCurrentPointIndex(0);
    lastFrameTimeRef.current = null;
    
    console.log('Playback stopped and state reset');
  }, []);
  
  // Cleanup animation on unmount
  useEffect(() => {
    // Clean up interval when component unmounts
    return () => {
      if (focusedBusRefreshInterval.current) {
        clearInterval(focusedBusRefreshInterval.current);
        focusedBusRefreshInterval.current = null;
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
                <CustomVehicleMarker vehicle={vehicle} />
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

  // Update the clear focus function to stop focused refreshes
  const clearFocus = useCallback(() => {
    setFocusedVehicle(null);
    
    // Clear focused bus refresh interval
    if (focusedBusRefreshInterval.current) {
      clearInterval(focusedBusRefreshInterval.current);
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
      
      // Automatically pan the map to show all vehicles on this route
      if (filtered.length > 0) {
        setTimeout(() => {
          // Get map instance
          const map = (window as any).leafletMap;
          if (!map) return;
          
          try {
            // Only include vehicles with trail data
            const vehiclesWithTrail = filtered.filter(v => v.trail && v.trail.length > 0);
            
            if (vehiclesWithTrail.length === 0) return;
            
            // If we only have one vehicle, center on it with a closer zoom
            if (vehiclesWithTrail.length === 1 && vehiclesWithTrail[0].trail.length > 0) {
              const vehicle = vehiclesWithTrail[0];
              const position = [vehicle.trail[0].lat, vehicle.trail[0].lng];
              map.setView(position, 15, { animate: true, duration: 1 });
              return;
            }
            
            // Create a bounds object to contain all points
            const bounds = L.latLngBounds([]);
            
            // Add all vehicle positions to the bounds
            vehiclesWithTrail.forEach(vehicle => {
              if (vehicle.trail && vehicle.trail.length > 0) {
                bounds.extend([vehicle.trail[0].lat, vehicle.trail[0].lng]);
              }
            });
            
            // If bounds are valid (has points), fit the map to these bounds
            if (bounds.isValid()) {
              map.fitBounds(bounds, { 
                padding: [50, 50], // Add padding around the bounds
                maxZoom: 15,       // Don't zoom in too much
                animate: true,
                duration: 1
              });
            }
          } catch (error) {
            console.error('Error auto-panning map:', error);
          }
        }, 100);
      }
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
      handleVehicleFocus(vehicle);
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

  // Format hour for slider display
  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hourDisplay = hour % 12 === 0 ? 12 : hour % 12;
    return `${hourDisplay} ${ampm}`;
  };

  // Additional functions for playback
  const formatPlaybackTime = (positionPercent: number) => {
    if (sortedTrailPoints.length < 2) return "00:00";
    
    const startTime = new Date(sortedTrailPoints[0].timestamp).getTime();
    const endTime = new Date(sortedTrailPoints[sortedTrailPoints.length - 1].timestamp).getTime();
    const totalDuration = endTime - startTime;
    
    const currentMs = (positionPercent / 100) * totalDuration;
    
    // Convert to minutes and seconds
    const totalSeconds = Math.floor(currentMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
      
      // Enable auto-panning for the next data load
      setShouldAutoPanMap(true);
      setIsUserInteracting(true);
    }
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
    
    // Enable auto-panning for the next data load
    setShouldAutoPanMap(true);
    setIsUserInteracting(true);
  };

  // Toggle playback
  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, stopPlayback]);

  // Reset playback to beginning
  const resetPlayback = useCallback(() => {
    stopPlayback();
    setPlaybackPosition(0);
    setCurrentPointIndex(0);
  }, [stopPlayback]);

  // Change playback speed
  const handleSpeedChange = useCallback(() => {
    // Cycle through speeds: 1x -> 2x -> 4x -> 1x
    setPlaybackSpeed(prevSpeed => {
      if (prevSpeed === 1) return 2;
      if (prevSpeed === 2) return 4;
      return 1;
    });
  }, []);

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
    
    // Calculate the total duration of the trail
    const startTime = new Date(sortedTrailPoints[0].timestamp).getTime();
    const endTime = new Date(sortedTrailPoints[sortedTrailPoints.length - 1].timestamp).getTime();
    const totalDurationMs = endTime - startTime;
    
    if (totalDurationMs === 0) {
      setCurrentPointIndex(0);
      return;
    }
    
    const currentTimePosition = (position / 100) * totalDurationMs;
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
  }, [stopPlayback, sortedTrailPoints]);

  // Function to start playback
  const startPlayback = useCallback(() => {
    console.log("StartPlayback called with state:", {
      hasAnimationVehicle: !!animationVehicle,
      trailPointsLength: sortedTrailPoints.length,
      currentPointIndex
    });

    // First clear any existing animation
    if (animationRef.current !== null) {
      console.log("Canceling existing animation");
      cancelAnimationFrame(animationRef.current);
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
    
    // Ensure the map is centered on the starting point of the playback
    if (currentPointIndex >= 0 && currentPointIndex < sortedTrailPoints.length) {
      const startPoint = sortedTrailPoints[currentPointIndex];
      const map = (window as any).leafletMap;
      if (map) {
        map.setView([startPoint.lat, startPoint.lng], 15, { animate: true });
      }
    }
    
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
    
    // Animation frame function
    const animate = (currentTime: number) => {
      if (!isPlaying) return;
      
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
        return;
      }
      
      // Calculate percentage through the playback
      const newPosition = rawProgress * 100;
      
      // Check if we should handle a significant time gap
      if (beforeIndex < timeGaps.length) {
        const timeGap = timeGaps[beforeIndex];
        const isSignificantGap = timeGap > significantGapMs;
        
        // Determine if we need to quickly jump ahead (for large time gaps)
        if (isSignificantGap) {
          console.log(`Significant time gap at index ${beforeIndex}: ${timeGap / 1000}s`);
          // Move to next point after the gap
          beforeIndex = afterIndex;
          afterIndex = Math.min(afterIndex + 1, sortedTrailPoints.length - 1);
        }
      }
      
      // Only update if we're at a new point
      if (currentPointIndex !== beforeIndex) {
        console.log(`Moving to point ${beforeIndex}`);
        setCurrentPointIndex(beforeIndex);
        
        // Pan the map to the current point with smoother animation
        const map = (window as any).leafletMap;
        if (map) {
          const currentPoint = sortedTrailPoints[beforeIndex];
          
          // Calculate where the next few points are heading to provide a better view
          let lookAheadIndex = Math.min(beforeIndex + 3, sortedTrailPoints.length - 1);
          const lookAheadPoint = sortedTrailPoints[lookAheadIndex];
          
          // Center slightly ahead of the current position to show where the vehicle is going
          if (lookAheadPoint && currentPoint) {
            // Calculate a position slightly ahead of the current position (20% of the way to the look-ahead point)
            const panLat = currentPoint.lat + (lookAheadPoint.lat - currentPoint.lat) * 0.2;
            const panLng = currentPoint.lng + (lookAheadPoint.lng - currentPoint.lng) * 0.2;
            
            // Pan with slight animation but not too slow to keep up with playback
            map.panTo([panLat, panLng], { 
              animate: true, 
              duration: 0.3,
              easeLinearity: 0.5
            });
          } else {
            // If we can't look ahead, just center on the current point
            map.panTo([currentPoint.lat, currentPoint.lng], { animate: true, duration: 0.3 });
          }
        }
      }
      
      // Update position indicator
      setPlaybackPosition(newPosition);
      
      // Request next frame
      animationRef.current = requestAnimationFrame(animate);
    };
    
    // Start the animation
    animationRef.current = requestAnimationFrame(animate);
  }, [animationVehicle, sortedTrailPoints, currentPointIndex, playbackSpeed, TIME_SCALE, isPlaying]);

  // Add the handleVehicleSelect function
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
            
        // Generate mock trail points
        generateMockTrailPoints(basePoint, 10);
        return;
      }
      
      try {
        // Create a safe copy and sort trail points by timestamp (oldest to newest)
        const trailCopy = foundVehicle.trail.map(point => ({
          lat: typeof point.lat === 'string' ? parseFloat(point.lat) : Number(point.lat),
          lng: typeof point.lng === 'string' ? parseFloat(point.lng) : Number(point.lng),
          timestamp: point.timestamp
        }));
        
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
        } else {
          // Not enough points after processing, generate mock data
          console.log('Not enough valid trail points after processing, using mock data');
          generateMockTrailPoints(trailCopy[0], 10);
        }
      } catch (error) {
        console.error('Error processing trail points:', error);
        
        // Generate mock data on error
        console.log('Error in trail processing, using mock data');
        const mockPoint = { 
          lat: 12.9716, 
          lng: 77.5946, 
          timestamp: new Date().toISOString() 
        };
        generateMockTrailPoints(mockPoint, 10);
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
      const mockPoint = { 
        lat: 12.9716, 
        lng: 77.5946, 
        timestamp: new Date().toISOString() 
      };
      generateMockTrailPoints(mockPoint, 10);
    }
  };

  // UseEffect for search term changes
  useEffect(() => {
    debouncedSearch(searchInput);
    return () => debouncedSearch.cancel();
  }, [searchInput, debouncedSearch]);

  // Create a custom VehicleMarker component within the App scope
  const CustomVehicleMarker = ({ vehicle }: { vehicle: VehicleData }) => {
    const isOffline = offlineVehicleIds.has(vehicle.deviceId);
    const isSelected = selectedVehicle === vehicle.deviceId;
    
    // Create a marker icon based on vehicle properties
    const getMarkerIcon = () => {
      const color = isOffline ? '#EA4335' : getVehicleColor(vehicle.provider);
      
      // Highlight selected vehicle
      if (isSelected) {
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
          iconAnchor: [11, 11]
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
        iconAnchor: [7, 7]
      });
    };
    
    // Skip rendering if this vehicle is currently being animated
    if (isPlaying && animationVehicle?.deviceId === vehicle.deviceId) {
      return null;
    }
    
    // Get the latest position
    const currentPosition = vehicle.trail.length > 0 
      ? vehicle.trail[0] 
      : { lat: 0, lng: 0, timestamp: new Date().toISOString() };
    
    return (
      <Marker
        position={[currentPosition.lat, currentPosition.lng]}
        icon={getMarkerIcon()}
        eventHandlers={{
          click: () => {
            console.log('Marker clicked for vehicle:', vehicle.deviceId);
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

  // Code to fix the vehicle finding in clearVehicleFocus
  const getVehicleById = (id: string): VehicleData | undefined => {
    return vehicles.find(v => v.deviceId === id);
  };

  // Add a state for tracking slider interaction
  const [isSliderMoving, setIsSliderMoving] = useState<boolean>(false);

  // Add this before fetchVehicles function
  // State to track if map should auto-pan after loading
  const [shouldAutoPanMap, setShouldAutoPanMap] = useState<boolean>(true);

  // Process vehicles data efficiently with a single pass
  const processVehiclesData = (prevVehicles: VehicleData[], newVehicles: VehicleData[]) => {
    // Create lookup map for previous vehicles for O(1) access instead of O(n) search
    const prevVehicleMap = new Map(prevVehicles.map(v => [v.deviceId, v]));
    
    // Extract route information during processing
    const routeSet = new Set<string>();
    const routesData: Record<string, VehicleData[]> = {};
    
    // Track offline vehicles
    const currentTime = new Date();
    const fiveMinutesAgo = new Date(currentTime.getTime() - 5 * 60 * 1000);
    const hourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000);
    const offlineIds = new Set<string>();
    
    // Process each vehicle from the response with a single iteration
    const updatedVehicles = newVehicles.map(newVehicle => {
      // Get previous vehicle data for smooth transitions
      const prevVehicle = prevVehicleMap.get(newVehicle.deviceId);
      
      // Add route information to sets
      if (newVehicle.routeId) {
        routeSet.add(newVehicle.routeId);
        if (!routesData[newVehicle.routeId]) routesData[newVehicle.routeId] = [];
        routesData[newVehicle.routeId].push(newVehicle);
      } else if (newVehicle.routeNumber) {
        routeSet.add(newVehicle.routeNumber);
        if (!routesData[newVehicle.routeNumber]) routesData[newVehicle.routeNumber] = [];
        routesData[newVehicle.routeNumber].push(newVehicle);
      }
      
      // Check for offline status (has data in last hour but not in last 5 minutes)
      if (newVehicle.trail.length > 0) {
        const lastPointTime = new Date(newVehicle.trail[0].timestamp);
        
        if (lastPointTime > hourAgo && lastPointTime < fiveMinutesAgo) {
          offlineIds.add(newVehicle.deviceId);
        }
      }
      
      // If this vehicle already exists, preserve its previous position for smooth transitions
      if (prevVehicle && newVehicle.trail.length > 0 && prevVehicle.trail.length > 0) {
        return {
          ...newVehicle,
          prevPosition: prevVehicle.trail[0]
        };
      }
      
      return newVehicle;
    });
    
    console.log('Updated vehicles state with', updatedVehicles.length, 'vehicles');
    
    // Update route-related states in a batch
    setAvailableRoutes(Array.from(routeSet).sort());
    
    // Update offline vehicles state
    setOfflineVehicleIds(offlineIds);
    setOfflineVehicles(offlineIds.size);
    
    // Update filtered vehicles if a route is selected
    if (selectedRoute && routesData[selectedRoute]) {
      setFilteredVehicles(routesData[selectedRoute]);
    }
    
    return updatedVehicles;
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
                {dailyCoverage.providers.map(providerData => (
                  <Box key={providerData.name} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ 
                          textTransform: 'capitalize',
                          fontWeight: 'medium'
                        }}>
                          {providerData.name === 'amnex' ? 'Amnex' : 
                           providerData.name === 'chalo' ? 'Chalo' : 
                           providerData.name}
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
                            backgroundColor: PROVIDER_COLORS[providerData.name.toLowerCase()] || PROVIDER_COLORS.default
                          }
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {providerData.totalVehicles} buses
                      </Typography>
                    </Box>
                  </Box>
                ))}
                
                <Typography variant="caption" sx={{ display: 'block', mt: 0, mb: 2, color: 'text.secondary', fontSize: '10px' }}>
                  Last updated: {dailyCoverage.timestamp ? new Date(dailyCoverage.timestamp).toLocaleString() : 'Unknown'}
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
                  {focusedVehicle?.vehicleNumber || 'Unknown Vehicle'}
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
                              handleVehicleFocus(vehicle);
                              handleVehicleSelect(vehicle.deviceId); // Keep only this line to trigger playback
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