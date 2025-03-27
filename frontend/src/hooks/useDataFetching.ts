import { useState, useCallback, useEffect, useRef } from 'react';
import { VehicleData, DailyCoverage } from '../types';
import { debounce } from '../utils/helpers';
import { REFRESH_INTERVAL, FOCUSED_BUS_REFRESH_INTERVAL } from '../utils/constants';
import { 
  fetchVehiclesData, 
  fetchOfflineVehicles, 
  fetchDailyCoverage, 
  fetchFocusedVehicle 
} from '../services/api';

interface UseDataFetchingResult {
  vehicles: VehicleData[];
  loading: boolean;
  error: string | null;
  isLoading: boolean;
  offlineVehicles: number;
  offlineVehicleIds: Set<string>;
  dailyCoverage: DailyCoverage | null;
  coverageLoading: boolean;
  totalFleetSize: number;
  isUserInteracting: boolean;
  selectedDate: Date;
  selectedHour: number;
  startTime: Date;
  endTime: Date;
  focusedVehicle: string | null;
  setSelectedDate: (date: Date) => void;
  setSelectedHour: (hour: number) => void;
  setIsUserInteracting: (value: boolean) => void;
  setFocusedVehicle: (deviceId: string | null) => void;
  setTotalFleetSize: (size: number) => void;
  fetchData: () => Promise<void>;
  fetchFocusedVehicleData: (deviceId: string) => Promise<void>;
  handleDateChange: (date: Date | null) => void;
  handleHourChange: (event: Event, newValue: number | number[]) => void;
  clearFocus: () => void;
  handleVehicleFocus: (deviceId: string) => void;
}

const useDataFetching = (): UseDataFetchingResult => {
  // State variables
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Only for initial load
  const [offlineVehicles, setOfflineVehicles] = useState<number>(0);
  const [offlineVehicleIds, setOfflineVehicleIds] = useState<Set<string>>(new Set());
  const [dailyCoverage, setDailyCoverage] = useState<DailyCoverage | null>(null);
  const [coverageLoading, setCoverageLoading] = useState<boolean>(false);
  const [totalFleetSize, setTotalFleetSize] = useState<number>(3700); // Default total fleet size
  const [isUserInteracting, setIsUserInteracting] = useState<boolean>(false);
  const [focusedVehicle, setFocusedVehicle] = useState<string | null>(null);
  
  // Time state
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    // Reset time to beginning of the day
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [selectedHour, setSelectedHour] = useState<number>(new Date().getHours());
  const [startTime, setStartTime] = useState<Date>(() => {
    const date = new Date();
    date.setHours(date.getHours() - 1);
    return date;
  });
  const [endTime, setEndTime] = useState<Date>(new Date());

  // Refs
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusedBusRefreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch main data function
  const fetchData = useCallback(async () => {
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
      
      // Update the time range state
      setStartTime(start);
      setEndTime(end);
      
      // Fetch vehicle data
      const vehiclesData = await fetchVehiclesData(start, end);
      
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
        
        return updatedVehicles;
      });
      
      // Fetch offline vehicles data
      const { offlineCount, offlineIds } = await fetchOfflineVehicles();
      setOfflineVehicles(offlineCount);
      setOfflineVehicleIds(offlineIds);
      
      // Fetch coverage data if applicable
      await fetchCoverageData();
      
      // Turn off loading states
      setLoading(false);
      setIsLoading(false);
      setError(null);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      setLoading(false);
      setIsLoading(false);
    }
  }, [selectedDate, selectedHour]);

  // Fetch coverage data
  const fetchCoverageData = useCallback(async () => {
    if (isUserInteracting) return;
    
    try {
      setCoverageLoading(true);
      const coverageData = await fetchDailyCoverage();
      
      if (coverageData) {
        setDailyCoverage(coverageData);
        
        // Set total fleet size if available from the API
        if (coverageData.totalFleetSize) {
          setTotalFleetSize(coverageData.totalFleetSize);
        }
      }
      
      setCoverageLoading(false);
    } catch (error) {
      console.error('Error fetching daily coverage:', error);
      setCoverageLoading(false);
    }
  }, [isUserInteracting]);

  // Fetch focused vehicle data
  const fetchFocusedVehicleData = useCallback(async (deviceId: string) => {
    if (!deviceId) return;
    
    try {
      // Calculate time range using selected date and hour
      const start = new Date(selectedDate);
      start.setHours(selectedHour);
      start.setMinutes(0);
      start.setSeconds(0);
      
      const end = new Date(selectedDate);
      end.setHours(selectedHour + 1);
      end.setMinutes(0);
      end.setSeconds(0);
      
      const focusedVehicleData = await fetchFocusedVehicle(deviceId, start, end);
      
      if (focusedVehicleData) {
        // Update only the focused vehicle in state
        setVehicles(prevVehicles => {
          return prevVehicles.map(vehicle => {
            if (vehicle.deviceId === deviceId) {
              return {
                ...focusedVehicleData,
                prevPosition: vehicle.trail[0] // Keep previous position for smooth animation
              };
            }
            return vehicle;
          });
        });
      }
    } catch (error) {
      console.error(`Error fetching focused vehicle ${deviceId}:`, error);
    }
  }, [selectedDate, selectedHour]);

  // Create debounced version of fetchData for time changes
  const debouncedFetchData = useCallback(
    debounce(() => {
      setIsUserInteracting(false);
      fetchData();
    }, 800),
    [fetchData]
  );

  // Handle date change
  const handleDateChange = useCallback((date: Date | null) => {
    if (!date) return;
    
    // Don't allow selection of future dates
    const now = new Date();
    if (date > now) {
      // Set to beginning of today
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      setSelectedDate(today);
      
      // If today is selected and the hour is in the future, adjust it
      if (selectedHour > now.getHours()) {
        setSelectedHour(now.getHours());
      }
    } else {
      setSelectedDate(date);
    }
    
    setIsUserInteracting(true);
    debouncedFetchData();
  }, [debouncedFetchData, selectedHour]);

  // Handle hour change
  const handleHourChange = useCallback((event: Event, newValue: number | number[]) => {
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
  }, [selectedDate, debouncedFetchData]);

  // Handle focusing on a vehicle
  const handleVehicleFocus = useCallback((deviceId: string) => {
    setFocusedVehicle(deviceId);
    
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
    if (focusedBusRefreshInterval.current) {
      clearInterval(focusedBusRefreshInterval.current);
    }
    
    // Set up a new refresh interval for this focused bus
    const intervalId = setInterval(() => {
      // Only refresh if still the same focused bus and not user interacting with time
      if (focusedVehicle === deviceId && !isUserInteracting) {
        fetchFocusedVehicleData(deviceId);
      }
    }, FOCUSED_BUS_REFRESH_INTERVAL);
    
    focusedBusRefreshInterval.current = intervalId;
    
    // Do an immediate fetch for the latest data
    fetchFocusedVehicleData(deviceId);
  }, [vehicles, focusedVehicle, isUserInteracting, fetchFocusedVehicleData]);

  // Clear focus on vehicle
  const clearFocus = useCallback(() => {
    setFocusedVehicle(null);
    
    // Clear focused bus refresh interval
    if (focusedBusRefreshInterval.current) {
      clearInterval(focusedBusRefreshInterval.current);
      focusedBusRefreshInterval.current = null;
    }
  }, []);

  // Initial data fetch and set up refresh intervals
  useEffect(() => {
    // Initial data fetch
    fetchData();
    
    // Set up interval for periodic refresh
    const intervalId = setInterval(() => {
      // Only do background refreshes if user is not interacting with time controls
      // and not focusing on a specific bus (which has its own refresh)
      if (!isUserInteracting && !focusedVehicle) {
        fetchData();
      }
    }, REFRESH_INTERVAL);
    
    intervalRef.current = intervalId;
    
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      if (focusedBusRefreshInterval.current) {
        clearInterval(focusedBusRefreshInterval.current);
      }
    };
  }, [fetchData, isUserInteracting, focusedVehicle]);

  return {
    vehicles,
    loading,
    error,
    isLoading,
    offlineVehicles,
    offlineVehicleIds,
    dailyCoverage,
    coverageLoading,
    totalFleetSize,
    isUserInteracting,
    selectedDate,
    selectedHour,
    startTime,
    endTime,
    focusedVehicle,
    setSelectedDate,
    setSelectedHour,
    setIsUserInteracting,
    setFocusedVehicle,
    setTotalFleetSize,
    fetchData,
    fetchFocusedVehicleData,
    handleDateChange,
    handleHourChange,
    clearFocus,
    handleVehicleFocus
  };
};

export default useDataFetching; 