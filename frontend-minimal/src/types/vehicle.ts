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