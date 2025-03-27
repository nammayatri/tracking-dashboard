import React from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import { Box, Button, Chip, Typography } from '@mui/material';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { VehicleData } from '../types';
import { getMarkerIcon } from '../utils/helpers';

interface VehicleMarkerProps {
  vehicle: VehicleData;
  selectedVehicle: string | null;
  offlineVehicleIds: Set<string>;
  onVehicleSelect: (deviceId: string) => void;
}

const VehicleMarker: React.FC<VehicleMarkerProps> = ({ 
  vehicle, 
  selectedVehicle, 
  offlineVehicleIds, 
  onVehicleSelect 
}) => {
  const map = useMap();
  
  // Default to the latest position
  const currentPosition = vehicle.trail.length > 0 
    ? vehicle.trail[0] 
    : { lat: 0, lng: 0, timestamp: new Date().toISOString() };
  
  const isOffline = offlineVehicleIds.has(vehicle.deviceId);
  const isSelected = selectedVehicle === vehicle.deviceId;
  
  const handleMarkerClick = () => {
    console.log('Marker clicked for vehicle:', vehicle.deviceId);
    
    // Center map on the vehicle
    map.setView([currentPosition.lat, currentPosition.lng], 15);
    
    // Select the vehicle
    onVehicleSelect(vehicle.deviceId);
  };
  
  const handleShowDetailsClick = () => {
    console.log('Show details button clicked for vehicle:', vehicle.deviceId);
    onVehicleSelect(vehicle.deviceId);
  };

  return (
    <Marker
      position={[currentPosition.lat, currentPosition.lng]}
      icon={getMarkerIcon(isSelected, isOffline)}
      eventHandlers={{ click: handleMarkerClick }}
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
            onClick={handleShowDetailsClick}
            startIcon={<PlayArrowIcon />}
            color="primary"
          >
            {vehicle.trail.length > 1 ? 'Show Playback' : 'Show Details'}
          </Button>
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ display: 'block', fontSize: '10px', textAlign: 'center', mt: 0.5 }}
          >
            {vehicle.trail.length} trail points available
          </Typography>
        </Box>
      </Popup>
    </Marker>
  );
};

export default VehicleMarker; 