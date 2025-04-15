import React, { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker, useMap } from 'react-leaflet';
import { RouteVehicle, TrailPoint, EtaData } from '../types/vehicle';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  Box, 
  Typography, 
  Slider, 
  IconButton, 
  Paper, 
  Chip, 
  Tooltip, 
  useTheme, 
  alpha 
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SpeedIcon from '@mui/icons-material/Speed';
import RouteIcon from '@mui/icons-material/Route';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import DirectionsIcon from '@mui/icons-material/Directions';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Vehicle colors array
const vehicleColors = [
  '#FF5733', // Red-Orange
  '#33A8FF', // Blue
  '#33FF57', // Green
  '#FF33A8', // Pink
  '#A833FF', // Purple
  '#FFD433', // Yellow
  '#33FFDD', // Cyan
  '#FF8333', // Orange
  '#8333FF', // Indigo
  '#FF33FF'  // Magenta
];

// ETA colors - different from vehicle colors for better visibility
const etaColor = '#00BFA5'; // Teal
const etaHighlightColor = '#1DE9B6'; // Lighter teal for highlights

// Component to handle map center changes
const MapController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
};

// Empty state component
const EmptyMapState = () => {
  const theme = useTheme();
  const map = useMap();
  
  useEffect(() => {
    // Center the map on a default location
    map.setView([12.9716, 77.5946], 11);
  }, [map]);
  
  return (
    <Box 
      sx={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        backgroundColor: alpha(theme.palette.background.paper, 0.9),
        padding: 3,
        borderRadius: 2,
        textAlign: 'center',
        zIndex: 1000,
        boxShadow: theme.shadows[3],
        width: 250,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      <DirectionsIcon color="primary" sx={{ fontSize: 40, opacity: 0.7 }} />
      <Typography variant="h6" color="text.primary" fontWeight={500}>
        No vehicle selected
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Select a vehicle from the list to view its location and trail data
      </Typography>
    </Box>
  );
};

// Format time to display hours and minutes in a readable way
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

interface ProcessedVehicle extends RouteVehicle {
  color: string;
  index: number;
  sortedTrail: TrailPoint[];
}

interface VehicleMapProps {
  vehicles: RouteVehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
}

const VehicleMap: React.FC<VehicleMapProps> = ({ 
  vehicles, 
  selectedVehicleId,
  onSelectVehicle
}) => {
  const theme = useTheme();
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Default center (Bangalore)
  const defaultCenter: [number, number] = [12.9716, 77.5946];
  
  // Current center for the map
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter);

  // Process vehicles, sorting trails and assigning colors
  const processedVehicles = useMemo(() => {
    return vehicles.map((vehicle, index) => {
      const colorIndex = index % vehicleColors.length;
      const color = vehicleColors[colorIndex];
      
      // Sort trail points by timestamp
      const sortedTrail = [...vehicle.trail]
      // const sortedTrail = [...vehicle.trail].sort((a, b) => {
      //   return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      // });
      
      return {
        ...vehicle,
        color,
        index: index + 1,
        sortedTrail
      };
    });
  }, [vehicles]);

  // Currently selected vehicle
  const selectedVehicle = useMemo(() => {
    return processedVehicles.find(v => v.vehicleNumber === selectedVehicleId) || null;
  }, [processedVehicles, selectedVehicleId]);

  // Generate custom icons for each vehicle
  const vehicleIcons = useMemo(() => {
    return processedVehicles.map(vehicle => {
      const isSelected = vehicle.vehicleNumber === selectedVehicleId;
      return {
        vehicle,
        icon: new L.DivIcon({
          className: 'custom-vehicle-icon',
          html: `<div style="
            background-color: ${vehicle.color}; 
            width: ${isSelected ? '40px' : '28px'}; 
            height: ${isSelected ? '40px' : '28px'}; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            color: white; 
            font-weight: bold; 
            font-size: ${isSelected ? '16px' : '14px'};
            border: ${isSelected ? '3px solid white' : '2px solid white'};
            box-shadow: ${isSelected ? '0 0 10px rgba(0,0,0,0.5)' : '0 0 5px rgba(0,0,0,0.3)'};
            z-index: ${isSelected ? '1000' : '500'};
          ">${vehicle.index}</div>`,
          iconSize: [isSelected ? 40 : 28, isSelected ? 40 : 28],
          iconAnchor: [isSelected ? 20 : 14, isSelected ? 20 : 14],
        })
      };
    });
  }, [processedVehicles, selectedVehicleId]);

  // Effect to center map on selected vehicle
  useEffect(() => {
    if (selectedVehicle) {
      setMapCenter([selectedVehicle.location.lat, selectedVehicle.location.lng]);
    }
  }, [selectedVehicle]);

  // Playback trail functionality
  useEffect(() => {
    if (isPlaying && selectedVehicle && selectedVehicle.sortedTrail.length > 0) {
      // Clear any existing interval
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }

      // Start a new interval for playback
      playbackIntervalRef.current = setInterval(() => {
        setPlaybackIndex(prevIndex => {
          const nextIndex = prevIndex + 1;
          if (nextIndex >= selectedVehicle.sortedTrail.length) {
            setIsPlaying(false);
            return 0;
          }
          return nextIndex;
        });
      }, 1000 / playbackSpeed);
    } else if (!isPlaying && playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, selectedVehicle, playbackSpeed]);

  // Reset playback when selected vehicle changes
  useEffect(() => {
    setPlaybackIndex(0);
    setIsPlaying(false);
  }, [selectedVehicleId]);

  // Handler for play/pause button
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  // Handler for reset button
  const handleReset = () => {
    setPlaybackIndex(0);
    setIsPlaying(false);
  };

  // Handler for slider change
  const handleSliderChange = (_: Event, newValue: number | number[]) => {
    setPlaybackIndex(newValue as number);
  };

  // Handler for speed change
  const handleSpeedChange = () => {
    setPlaybackSpeed(prevSpeed => {
      // Cycle through speeds: 1x -> 2x -> 4x -> 0.5x -> 1x
      const speeds = [1, 2, 4, 0.5];
      const currentIndex = speeds.indexOf(prevSpeed);
      const nextIndex = (currentIndex + 1) % speeds.length;
      return speeds[nextIndex];
    });
  };

  // Get playback point if we're in playback mode
  const playbackPoint = useMemo(() => {
    if (selectedVehicle && selectedVehicle.sortedTrail.length > 0 && playbackIndex < selectedVehicle.sortedTrail.length) {
      const point = selectedVehicle.sortedTrail[playbackIndex];
      return { lat: point.lat, lng: point.lng };
    }
    return null;
  }, [selectedVehicle, playbackIndex]);

  // Maximum playback index value
  const maxPlaybackIndex = useMemo(() => {
    return selectedVehicle && selectedVehicle.sortedTrail.length > 0
      ? selectedVehicle.sortedTrail.length - 1
      : 0;
  }, [selectedVehicle]);

  // Determined filtered trail points to show
  const filteredTrailPoints = useMemo(() => {
    if (playbackPoint && selectedVehicle) {
      return selectedVehicle.sortedTrail.slice(0, playbackIndex + 1);
    }
    return [];
  }, [selectedVehicle, playbackIndex, playbackPoint]);

  // Calculate if we should show playback controls
  const showPlaybackControls = selectedVehicle && selectedVehicle.sortedTrail.length > 1;

  // Get the formatted timestamp for the current playback point
  const currentPlaybackTime = useMemo(() => {
    if (selectedVehicle && selectedVehicle.sortedTrail.length > 0 && playbackIndex < selectedVehicle.sortedTrail.length) {
      const timestamp = selectedVehicle.sortedTrail[playbackIndex].timestamp;
      return new Date(timestamp).toLocaleTimeString();
    }
    return '';
  }, [selectedVehicle, playbackIndex]);

  // No vehicles to display
  if (vehicles.length === 0) {
    return (
      <MapContainer
        center={defaultCenter}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <EmptyMapState />
      </MapContainer>
    );
  }

  return (
    <>
      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController center={mapCenter} />

        {/* Display an empty state if no vehicle is selected */}
        {vehicles.length > 0 && !selectedVehicleId && <EmptyMapState />}

        {/* Plot each vehicle on the map */}
        {vehicleIcons.map(({ vehicle, icon }) => (
          <Marker
            key={vehicle.vehicleNumber}
            position={[vehicle.location.lat, vehicle.location.lng]}
            icon={icon}
            eventHandlers={{
              click: () => onSelectVehicle(vehicle.vehicleNumber)
            }}
          >
            <Popup>
              <Box sx={{ minWidth: 200 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Vehicle {vehicle.vehicleNumber}
                </Typography>
                <Typography variant="body2">
                  Route: {vehicle.routeName}
                </Typography>
                <Typography variant="body2">
                  Last Updated: {new Date(vehicle.lastSeen).toLocaleTimeString()}
                </Typography>
              </Box>
            </Popup>
          </Marker>
        ))}

        {/* Display trail for selected vehicle */}
        {selectedVehicle && (
          <>
            {/* If we're in playback mode, show the filtered trail */}
            {isPlaying || playbackIndex > 0 ? (
              <Polyline
                positions={filteredTrailPoints.map(point => [point.lat, point.lng])}
                color={selectedVehicle.color}
                weight={4}
                opacity={0.8}
              />
            ) : (
              // Otherwise show the entire trail
              <Polyline
                positions={selectedVehicle.trail.map(point => [point.lat, point.lng])}
                color={selectedVehicle.color}
                weight={4}
                opacity={0.8}
              />
            )}

            {/* Show smaller markers for each trail point */}
            {selectedVehicle.trail.map((point, index) => (
              <CircleMarker
                key={`trail-${selectedVehicle.vehicleNumber}-${index}`}
                center={[point.lat, point.lng]}
                radius={isPlaying || playbackIndex > 0 ? (index <= playbackIndex ? 3 : 0) : 3}
                color={selectedVehicle.color}
                fillColor={selectedVehicle.color}
                fillOpacity={0.8}
                weight={1}
                opacity={0.8}
              >
                <Popup>
                  <Typography variant="body2">
                    Time: {new Date(point.timestamp).toLocaleTimeString()}
                  </Typography>
                </Popup>
              </CircleMarker>
            ))}

            {/* Show special marker for playback point */}
            {playbackPoint && (playbackIndex > 0 || isPlaying) && (
              <CircleMarker
                center={[playbackPoint.lat, playbackPoint.lng]}
                radius={8}
                color={selectedVehicle.color}
                fillColor={selectedVehicle.color}
                fillOpacity={1}
                weight={3}
                opacity={1}
              >
                <Popup>
                  <Typography variant="body2">
                    Time: {currentPlaybackTime}
                  </Typography>
                </Popup>
              </CircleMarker>
            )}

            {/* Show ETA points if they exist */}
            {selectedVehicle.etaData && selectedVehicle.etaData.map((eta, index) => (
              <CircleMarker
                key={`eta-${selectedVehicle.vehicleNumber}-${index}`}
                center={[eta.stop_lat, eta.stop_lon]}
                radius={7}
                color={etaColor}
                fillColor={etaHighlightColor}
                fillOpacity={0.7}
                weight={2}
                opacity={0.8}
              >
                <Popup>
                  <Box sx={{ p: 1, minWidth: 200 }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      {eta.stop_name}
                    </Typography>
                    <Typography variant="body2">
                      Scheduled arrival: {formatTime(eta.arrival_time)}
                    </Typography>
                  </Box>
                </Popup>
              </CircleMarker>
            ))}
          </>
        )}
      </MapContainer>

      {/* Playback controls */}
      {showPlaybackControls && (
        <Paper 
          elevation={0} 
          sx={{ 
            position: 'absolute', 
            bottom: 16, 
            left: '50%', 
            transform: 'translateX(-50%)', 
            zIndex: 1000, 
            p: 2, 
            width: '90%', 
            maxWidth: 500,
            borderRadius: 2,
            backgroundColor: alpha(theme.palette.background.paper, 0.95),
            boxShadow: theme.shadows[4]
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1, 
              py: 0.5, 
              px: 1.5, 
              borderRadius: 1.5,
              backgroundColor: alpha(selectedVehicle.color, 0.1),
              border: `1px solid ${alpha(selectedVehicle.color, 0.2)}`,
            }}>
              <RouteIcon sx={{ color: selectedVehicle.color, fontSize: 18 }} />
              <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.primary' }}>
                Trail Playback
              </Typography>
            </Box>
            
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', fontFamily: 'monospace' }}>
              {currentPlaybackTime || 'No data'}
            </Typography>
            
            <Tooltip title={`Playback speed: ${playbackSpeed}x`}>
              <IconButton size="small" onClick={handleSpeedChange} color="inherit" sx={{ p: 0.75 }}>
                <SpeedIcon fontSize="small" />
                <Typography variant="caption" sx={{ ml: 0.5, fontWeight: 'bold' }}>
                  {playbackSpeed}x
                </Typography>
              </IconButton>
            </Tooltip>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton 
              onClick={handlePlayPause} 
              color="primary" 
              sx={{ 
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.15),
                }
              }}
            >
              {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            
            <IconButton 
              onClick={handleReset} 
              color="inherit"
              disabled={playbackIndex === 0}
              sx={{ 
                color: 'text.secondary',
                opacity: playbackIndex === 0 ? 0.5 : 1,
              }}
            >
              <RestartAltIcon />
            </IconButton>
            
            <Slider
              value={playbackIndex}
              onChange={handleSliderChange}
              min={0}
              max={maxPlaybackIndex}
              valueLabelDisplay="auto"
              valueLabelFormat={() => currentPlaybackTime}
              sx={{ 
                mx: 1,
                '& .MuiSlider-thumb': {
                  width: 14,
                  height: 14,
                  backgroundColor: selectedVehicle.color,
                  '&:hover, &.Mui-focusVisible': {
                    boxShadow: `0px 0px 0px 8px ${alpha(selectedVehicle.color, 0.16)}`
                  }
                },
                '& .MuiSlider-track': {
                  backgroundColor: selectedVehicle.color,
                },
                '& .MuiSlider-rail': {
                  backgroundColor: alpha(selectedVehicle.color, 0.25),
                }
              }}
            />
          </Box>
          
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            mt: 0.5,
            px: 1,
          }}>
            <Typography variant="caption" color="text.secondary">
              Start: {selectedVehicle.sortedTrail.length > 0 ? 
                new Date(selectedVehicle.sortedTrail[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              End: {selectedVehicle.sortedTrail.length > 0 ? 
                new Date(selectedVehicle.sortedTrail[selectedVehicle.sortedTrail.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
            </Typography>
          </Box>
        </Paper>
      )}
    </>
  );
};

export default VehicleMap; 