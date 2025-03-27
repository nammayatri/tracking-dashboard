import L from 'leaflet';
import { PROVIDER_COLORS } from './constants';

// Create a simple debounce function
export const debounce = <F extends (...args: any[]) => any>(
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

// Function to calculate distance between two points using Haversine formula
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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

// Format timestamp for display
export const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short'
  });
};

// Function to convert local time to IST (for backend query)
export const convertToIST = (date: Date): Date => {
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
export const isFutureDate = (date: Date): boolean => {
  const now = new Date();
  return date > now;
};

// Function to convert IST to local time (for display)
export const convertFromIST = (date: Date): Date => {
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

// Format hour for slider display
export const formatHour = (hour: number): string => {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hourDisplay = hour % 12 === 0 ? 12 : hour % 12;
  return `${hourDisplay} ${ampm}`;
};

// Get color based on provider
export const getVehicleColor = (provider: string | null): string => {
  if (!provider) return PROVIDER_COLORS.default;
  
  const lowerProvider = provider.toLowerCase();
  return PROVIDER_COLORS[lowerProvider as keyof typeof PROVIDER_COLORS] || PROVIDER_COLORS.default;
};

// Create custom marker icons with different colors
export const createColoredIcon = (color: string): L.DivIcon => {
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
export const createTrailPointIcon = (color: string): L.DivIcon => {
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

// Get marker icon based on whether it's selected or offline
export const getMarkerIcon = (isSelected: boolean, isOffline: boolean): L.DivIcon => {
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