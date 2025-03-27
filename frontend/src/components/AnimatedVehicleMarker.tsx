import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { Box, Typography, Chip } from '@mui/material';
import DirectionsTransitIcon from '@mui/icons-material/DirectionsTransit';
import { VehicleData, TrailPoint } from '../types';
import { formatTimestamp } from '../utils/helpers';

interface AnimatedVehicleMarkerProps {
  vehicle: VehicleData;
  currentPoint: TrailPoint;
  isPlaying: boolean;
}

const AnimatedVehicleMarker: React.FC<AnimatedVehicleMarkerProps> = ({
  vehicle,
  currentPoint,
  isPlaying
}) => {
  if (!currentPoint) return null;

  // Create a custom animated marker icon
  const customIcon = divIcon({
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `
      <div style="
        display: flex;
        justify-content: center;
        align-items: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: ${isPlaying ? '#4285F4' : '#3f51b5'};
        color: white;
        box-shadow: 0 0 10px rgba(0,0,0,0.5), 0 0 ${isPlaying ? '15px' : '0px'} ${isPlaying ? '#4285F4' : 'transparent'};
        border: 2px solid white;
        font-size: 18px;
        font-weight: bold;
        animation: ${isPlaying ? 'pulse 1.5s infinite' : 'none'};
        z-index: 1000;
        transform: translate3d(0,0,0);
      ">
        <svg style="width: 24px; height: 24px; fill: white;" viewBox="0 0 24 24">
          <path d="M4,16c0,0.88 0.39,1.67 1,2.22V20c0,0.55 0.45,1 1,1h1c0.55,0 1-0.45 1-1v-1h8v1c0,0.55 0.45,1 1,1h1c0.55,0 1-0.45 1-1v-1.78c0.61-0.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4,2.5 4,6V16z M7.5,17A1.5,1.5 0 0,1 6,15.5A1.5,1.5 0 0,1 7.5,14A1.5,1.5 0 0,1 9,15.5A1.5,1.5 0 0,1 7.5,17z M16.5,17A1.5,1.5 0 0,1 15,15.5A1.5,1.5 0 0,1 16.5,14A1.5,1.5 0 0,1 18,15.5A1.5,1.5 0 0,1 16.5,17z M18,11H6V6h12V11z" />
        </svg>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
      </style>
    `
  });

  return (
    <Marker 
      position={[currentPoint.lat, currentPoint.lng]} 
      icon={customIcon}
    >
      <Popup>
        <Box sx={{ minWidth: '200px', p: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
            {vehicle.vehicleNumber}
          </Typography>
          
          <Box sx={{ mb: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Route:</Typography>
              <Chip 
                label={vehicle.routeNumber || 'Unknown'} 
                size="small" 
                color="primary" 
                variant="outlined" 
                sx={{ fontWeight: 'bold' }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Provider:</Typography>
              <Typography variant="body2">{vehicle.provider || 'Unknown'}</Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Time:</Typography>
              <Typography variant="body2">{formatTimestamp(currentPoint.timestamp)}</Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">Playback:</Typography>
              <Chip 
                label={isPlaying ? 'Playing' : 'Paused'} 
                size="small" 
                color={isPlaying ? 'success' : 'default'} 
                icon={<DirectionsTransitIcon />} 
              />
            </Box>
          </Box>
        </Box>
      </Popup>
    </Marker>
  );
};

export default AnimatedVehicleMarker; 