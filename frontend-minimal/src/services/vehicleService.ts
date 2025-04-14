import api from './api';
import { RouteVehicleResponse } from '../types/vehicle';

export const getVehicleRoute = async (routeId: string): Promise<RouteVehicleResponse> => {
  try {
    const response = await api.get<RouteVehicleResponse>(`/api/route-vehicles/${routeId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching vehicle route:', error);
    throw error;
  }
}; 