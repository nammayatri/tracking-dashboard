// API endpoints
export const API_BASE_URL = 'https://api.moving.tech/tracking';

// Map settings
export const DEFAULT_MAP_CENTER = { lat: 12.9716, lng: 77.5946 }; // Default fallback if no vehicles
export const MAX_POINT_DISTANCE_KM = 0.5; // Maximum distance in km between consecutive points in a trail

// Refresh intervals
export const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes refresh interval for general data
export const FOCUSED_BUS_REFRESH_INTERVAL = 10 * 1000; // 10 seconds refresh interval for focused bus

// Time settings
export const DEFAULT_TIME_RANGE = 60; // Default time range in minutes
export const TIME_SCALE = 1; // 1 second playback = 20 seconds real time

// Provider color mapping with more distinctive colors
export const PROVIDER_COLORS: Record<string, string> = {
  amnex: '#4285F4', // Google Blue
  chalo: '#34A853', // Google Green
  default: '#EA4335'  // Google Red
}; 