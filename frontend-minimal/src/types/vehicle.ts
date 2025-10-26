export interface EtaData {
  stop_name: string;
  arrival_time: number; // epoch timestamp
  stop_lat: number;
  stop_lon: number;
}

export interface Location {
  lat: number;
  lng: number;
}

export interface TrailPoint extends Location {
  timestamp: string;
}

export interface RouteVehicle {
  deviceId: string;
  vehicleNumber: string;
  routeId: string;
  routeName: string;
  provider: string | null;
  lastSeen: string;
  etaData: EtaData[];
  location: Location;
  trail: TrailPoint[];
}

export interface ErrorResponse {
  error: string;
  message: string;
}

export type RouteVehicleResponse = RouteVehicle[] | ErrorResponse;

// Vehicle tracking types
export interface VehicleTrackingData {
  vehicleNo: string;
  deviceId: string;
  routeId: string;
  routeNumber: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface VehicleTrackingSummary {
  recent: number;      // < 1 minute
  moderate: number;    // 1-5 minutes
  old: number;         // > 5 minutes
  total: number;
}

export type VehicleTrackingResponse = VehicleTrackingData[] | ErrorResponse; 