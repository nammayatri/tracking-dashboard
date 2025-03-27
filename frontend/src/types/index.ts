export interface TrailPoint {
  lat: number;
  lng: number;
  timestamp: string;
}

export interface VehicleData {
  deviceId: string;
  vehicleNumber: string;
  routeNumber: string;
  routeId: string | null;
  provider: string | null;
  trail: TrailPoint[];
  prevPosition?: TrailPoint; // For smooth transitions
}

export interface ProviderCoverage {
  provider: string;
  deviceCount: number;
  coverage: number;
}

export interface DailyCoverage {
  totalDevices: number;
  totalCoverage: number;
  providerCoverage: ProviderCoverage[];
  timestamp: string;
  totalFleetSize?: number;
}

export interface MapCenter {
  lat: number;
  lng: number;
} 