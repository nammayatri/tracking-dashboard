import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Chip,
  Tooltip,
  IconButton,
  useTheme,
  alpha,
  Fade,
  TextField,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  InputAdornment
} from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getVehicleTracking } from '../services/api';
import { VehicleTrackingData, VehicleTrackingSummary } from '../types/vehicle';
import Layout from '../components/Layout';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom marker icons based on vehicle status
const createCustomIcon = (color: string, size: number = 25) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: white;
      font-size: 12px;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Map center component to handle map updates
const MapCenter = ({ center, zoom, shouldUpdate, onZoomChange }: { 
  center: [number, number]; 
  zoom: number; 
  shouldUpdate: boolean;
  onZoomChange: (zoom: number) => void;
}) => {
  const map = useMap();
  
  useEffect(() => {
    if (shouldUpdate) {
      map.setView(center, zoom);
    }
  }, [map, center, zoom, shouldUpdate]);
  
  // Track zoom changes to preserve user's zoom level
  useEffect(() => {
    const handleZoomEnd = () => {
      onZoomChange(map.getZoom());
    };
    
    map.on('zoomend', handleZoomEnd);
    
    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map, onZoomChange]);
  
  return null;
};

// Vehicle marker component
const VehicleMarker = ({ 
  vehicle, 
  onHover, 
  onLeave 
}: { 
  vehicle: VehicleTrackingData & { status: 'recent' | 'moderate' | 'old' };
  onHover: (vehicle: VehicleTrackingData) => void;
  onLeave: () => void;
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
      onHover(vehicle);
    }, 2000); // 2 second delay
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowTooltip(false);
    onLeave();
  };

  const getMarkerColor = (status: string) => {
    switch (status) {
      case 'recent': return '#4caf50'; // Green
      case 'moderate': return '#ff9800'; // Orange
      case 'old': return '#f44336'; // Red
      default: return '#9e9e9e'; // Gray
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'recent': return 'Recent (< 1 min)';
      case 'moderate': return 'Moderate (1-5 min)';
      case 'old': return 'Old (> 5 min)';
      default: return 'Unknown';
    }
  };

  return (
    <Marker
      position={[vehicle.latitude, vehicle.longitude]}
      icon={createCustomIcon(getMarkerColor(vehicle.status))}
      eventHandlers={{
        mouseover: handleMouseEnter,
        mouseout: handleMouseLeave,
      }}
    >
      <Popup>
        <Box sx={{ minWidth: 200 }}>
          <Typography variant="h6" gutterBottom>
            {vehicle.vehicleNo}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DirectionsBusIcon fontSize="small" color="action" />
              <Typography variant="body2">
                Route: {vehicle.routeNumber} ({vehicle.routeId})
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon fontSize="small" color="action" />
              <Typography variant="body2">
                Device ID: {vehicle.deviceId}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon fontSize="small" color="action" />
              <Typography variant="body2">
                Last ping: {new Date(vehicle.timestamp * 1000).toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationOnIcon fontSize="small" color="action" />
              <Typography variant="body2">
                {vehicle.latitude.toFixed(6)}, {vehicle.longitude.toFixed(6)}
              </Typography>
            </Box>
            <Chip
              label={getStatusText(vehicle.status)}
              size="small"
              sx={{
                backgroundColor: getMarkerColor(vehicle.status),
                color: 'white',
                fontWeight: 'bold',
                alignSelf: 'flex-start'
              }}
            />
          </Box>
        </Box>
      </Popup>
    </Marker>
  );
};

// Summary card component
const SummaryCard = ({ 
  title, 
  count, 
  color, 
  icon 
}: { 
  title: string; 
  count: number; 
  color: string; 
  icon: React.ReactNode;
}) => (
  <Card sx={{ 
    background: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(color, 0.05)} 100%)`,
    border: `2px solid ${alpha(color, 0.2)}`,
    borderRadius: 2,
    transition: 'transform 0.2s ease-in-out',
    '&:hover': {
      transform: 'translateY(-2px)',
    }
  }}>
    <CardContent sx={{ textAlign: 'center', p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
        {icon}
        <Typography variant="h4" sx={{ fontWeight: 'bold', color, ml: 1 }}>
          {count}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
        {title}
      </Typography>
    </CardContent>
  </Card>
);

const VehicleTracking: React.FC = () => {
  const theme = useTheme();
  const [vehicles, setVehicles] = useState<(VehicleTrackingData & { status: 'recent' | 'moderate' | 'old' })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hoveredVehicle, setHoveredVehicle] = useState<VehicleTrackingData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([13.082254451184653, 80.2601554009136]); // Default center
  const [mapZoom, setMapZoom] = useState(12);
  const [shouldCenterMap, setShouldCenterMap] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Search states (no filtering)
  const [filterType, setFilterType] = useState<'vehicleNo' | 'routeId' | 'routeNumber'>('vehicleNo');
  const [searchTerm, setSearchTerm] = useState('');

  // Calculate vehicle status based on timestamp
  const getVehicleStatus = (timestamp: number): 'recent' | 'moderate' | 'old' => {
    const now = Date.now() / 1000; // Convert to seconds
    const diffMinutes = (now - timestamp) / 60;
    
    if (diffMinutes < 1) return 'recent';
    if (diffMinutes < 5) return 'moderate';
    return 'old';
  };


  // Fetch vehicle data
  const fetchVehicles = useCallback(async (showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      setError(null);
      const data = await getVehicleTracking();
      
      if (Array.isArray(data)) {
        const vehiclesWithStatus = data.map(vehicle => ({
          ...vehicle,
          status: getVehicleStatus(vehicle.timestamp)
        }));
        setVehicles(vehiclesWithStatus);
        setLastUpdated(new Date());
        
        // Only center map on initial load
        if (isInitialLoad) {
          setMapCenter(calculateOptimalCenter as [number, number]);
          setShouldCenterMap(true);
          setIsInitialLoad(false);
        } else {
          // For auto-refresh, don't recenter the map
          setShouldCenterMap(false);
        }
      } else {
        setError(data.error || 'Failed to fetch vehicle data');
      }
    } catch (err) {
      setError('Failed to fetch vehicle data');
      console.error('Error fetching vehicles:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [isInitialLoad]);

  // Initial load
  useEffect(() => {
    fetchVehicles(true); // Show loading on initial load
  }, [fetchVehicles]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchVehicles(false); // Don't show loading on auto-refresh
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchVehicles]);

  // Generate search suggestions based on filter type
  const searchSuggestions = useMemo(() => {
    const uniqueValues = new Set<string>();
    
    vehicles.forEach(vehicle => {
      switch (filterType) {
        case 'vehicleNo':
          uniqueValues.add(vehicle.vehicleNo);
          break;
        case 'routeId':
          uniqueValues.add(vehicle.routeId);
          break;
        case 'routeNumber':
          uniqueValues.add(vehicle.routeNumber);
          break;
      }
    });
    
    return Array.from(uniqueValues).sort();
  }, [vehicles, filterType]);

  // Filter vehicles based on search term
  const filteredVehicles = useMemo(() => {
    console.log('Filtering vehicles - searchTerm:', searchTerm, 'filterType:', filterType, 'total vehicles:', vehicles.length);
    console.log('All vehicles sample:', vehicles.slice(0, 5).map(v => v.vehicleNo));
    
    if (!searchTerm.trim()) {
      console.log('No search term, returning all vehicles');
      return vehicles;
    }
    
    const filtered = vehicles.filter(vehicle => {
      const searchValue = searchTerm.toLowerCase().trim();
      let matches = false;
      
      switch (filterType) {
        case 'vehicleNo':
          matches = vehicle.vehicleNo.toLowerCase() === searchValue;
          break;
        case 'routeId':
          matches = vehicle.routeId.toLowerCase() === searchValue;
          break;
        case 'routeNumber':
          matches = vehicle.routeNumber.toLowerCase() === searchValue;
          break;
        default:
          matches = true;
      }
      
      if (matches) {
        console.log('Vehicle matches:', vehicle.vehicleNo, 'filterType:', filterType, 'searchValue:', searchValue);
      }
      
      return matches;
    });
    
    console.log(`Search: "${searchTerm}" | Filter: ${filterType} | Found: ${filtered.length}/${vehicles.length} vehicles`);
    console.log('Filtered vehicles:', filtered.map(v => v.vehicleNo));
    return filtered;
  }, [vehicles, searchTerm, filterType]);

  // Calculate summary statistics based on filtered vehicles
  const summary: VehicleTrackingSummary = useMemo(() => {
    const recent = filteredVehicles.filter(v => v.status === 'recent').length;
    const moderate = filteredVehicles.filter(v => v.status === 'moderate').length;
    const old = filteredVehicles.filter(v => v.status === 'old').length;
    
    return {
      recent,
      moderate,
      old,
      total: filteredVehicles.length
    };
  }, [filteredVehicles]);

  // Calculate optimal map center based on filtered vehicle density
  const calculateOptimalCenter = useMemo(() => {
    if (filteredVehicles.length === 0) return [13.082254451184653, 80.2601554009136]; // Default center
    
    // Group vehicles by grid cells to find the densest area
    const gridSize = 0.01; // ~1km grid cells
    const vehicleGrid: Record<string, { count: number; lat: number; lng: number }> = {};
    
    filteredVehicles.forEach(vehicle => {
      const gridLat = Math.floor(vehicle.latitude / gridSize) * gridSize;
      const gridLng = Math.floor(vehicle.longitude / gridSize) * gridSize;
      const gridKey = `${gridLat},${gridLng}`;
      
      if (!vehicleGrid[gridKey]) {
        vehicleGrid[gridKey] = { count: 0, lat: gridLat + gridSize/2, lng: gridLng + gridSize/2 };
      }
      vehicleGrid[gridKey].count++;
    });
    
    // Find the grid cell with the most vehicles
    let maxCount = 0;
    let bestGrid = { lat: 0, lng: 0 };
    
    Object.values(vehicleGrid).forEach(grid => {
      if (grid.count > maxCount) {
        maxCount = grid.count;
        bestGrid = { lat: grid.lat, lng: grid.lng };
      }
    });
    
    // If we found a dense area, use it; otherwise use average
    if (maxCount > 1) {
      return [bestGrid.lat, bestGrid.lng];
    } else {
      // Fallback to average of all filtered vehicles
      const avgLat = filteredVehicles.reduce((sum, v) => sum + v.latitude, 0) / filteredVehicles.length;
      const avgLng = filteredVehicles.reduce((sum, v) => sum + v.longitude, 0) / filteredVehicles.length;
      return [avgLat, avgLng];
    }
  }, [filteredVehicles]);

  const handleRefresh = () => {
    setShouldCenterMap(true); // Force recentering on manual refresh
    fetchVehicles(true); // Show loading on manual refresh
  };

  const handleCenterOnVehicles = () => {
    setMapCenter(calculateOptimalCenter as [number, number]);
    setShouldCenterMap(true);
  };

  const handleVehicleHover = (vehicle: VehicleTrackingData) => {
    setHoveredVehicle(vehicle);
  };

  const handleVehicleLeave = () => {
    setHoveredVehicle(null);
  };

  const handleZoomChange = (zoom: number) => {
    setMapZoom(zoom);
  };

  if (loading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Loading vehicle data...
            </Typography>
          </Box>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 3 }}>
        {/* Header */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.12)',
          }}
        >
          <Box
            sx={{
              px: 3,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              backgroundColor: alpha(theme.palette.primary.main, 0.03),
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Typography
              variant="h5"
              component="h1"
              sx={{
                fontWeight: 500,
                color: 'text.primary',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <DirectionsBusIcon color="primary" />
              Real-time Vehicle Tracking
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {lastUpdated && (
                <Typography variant="caption" color="text.secondary">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </Typography>
              )}
              <Tooltip title="Center map on vehicles">
                <IconButton
                  onClick={handleCenterOnVehicles}
                  color="primary"
                >
                  <MyLocationIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh now">
                <IconButton
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  color="primary"
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Subtle refresh indicator - only show for auto-refresh */}
          {isRefreshing && !loading && (
            <Box sx={{ 
              position: 'absolute', 
              top: 8, 
              right: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
              borderRadius: 1,
              px: 1,
              py: 0.5,
              boxShadow: 1
            }}>
              <CircularProgress size={16} color="primary" />
              <Typography variant="caption" color="text.secondary">
                Updating...
              </Typography>
            </Box>
          )}
        </Paper>

        {error && (
          <Alert
            severity="error"
            variant="filled"
            sx={{
              borderRadius: 2,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.12)',
            }}
          >
            {error}
          </Alert>
        )}

        {/* Search Section */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.12)',
          }}
        >
          <Box
            sx={{
              px: 3,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              backgroundColor: alpha(theme.palette.primary.main, 0.03)
            }}
          >
            <Typography
              variant="h6"
              component="h2"
              sx={{
                fontWeight: 500,
                color: 'text.primary',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 2
              }}
            >
              <SearchIcon color="primary" />
              Search Vehicles
            </Typography>
            
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Search By</InputLabel>
                <Select
                  value={filterType}
                  label="Search By"
                  onChange={(e) => setFilterType(e.target.value as 'vehicleNo' | 'routeId' | 'routeNumber')}
                >
                  <MenuItem value="vehicleNo">Vehicle Number</MenuItem>
                  <MenuItem value="routeId">Route ID</MenuItem>
                  <MenuItem value="routeNumber">Route Number</MenuItem>
                </Select>
              </FormControl>
              
              <Autocomplete
                freeSolo
                options={searchSuggestions}
                value={searchTerm}
                onChange={(_, newValue) => setSearchTerm(newValue || '')}
                onInputChange={(_, newInputValue) => setSearchTerm(newInputValue)}
                sx={{ flex: 1, minWidth: 200 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={`Search by ${filterType === 'vehicleNo' ? 'Vehicle Number' : filterType === 'routeId' ? 'Route ID' : 'Route Number'}`}
                    placeholder="Type to search..."
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          {searchTerm && (
                            <IconButton
                              size="small"
                              onClick={() => setSearchTerm('')}
                              edge="end"
                            >
                              <ClearIcon />
                            </IconButton>
                          )}
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DirectionsBusIcon fontSize="small" color="action" />
                      {option}
                    </Box>
                  </Box>
                )}
              />
              
              {searchTerm && (
                <Chip
                  label={`${filteredVehicles.length} vehicles found`}
                  color="primary"
                  variant="outlined"
                  sx={{ fontWeight: 500 }}
                />
              )}
              
              {searchTerm && (
                <Tooltip title="Clear search">
                  <IconButton
                    onClick={() => setSearchTerm('')}
                    color="primary"
                    size="small"
                  >
                    <ClearIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Box>
        </Paper>

        {/* Main Content */}
        <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 200px)' }}>
          {/* Map */}
          <Box sx={{ flex: 1, borderRadius: 2, overflow: 'hidden', boxShadow: 2 }}>
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
            >
              <MapCenter 
                center={mapCenter} 
                zoom={mapZoom} 
                shouldUpdate={shouldCenterMap} 
                onZoomChange={handleZoomChange}
              />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              {(() => {
                console.log('About to render markers. filteredVehicles length:', filteredVehicles.length);
                console.log('filteredVehicles:', filteredVehicles.map(v => v.vehicleNo));
                return filteredVehicles.map((vehicle, index) => {
                  console.log('Rendering vehicle:', vehicle.vehicleNo, 'for search:', searchTerm, 'index:', index);
                  return (
                    <VehicleMarker
                      key={`${vehicle.vehicleNo}-${searchTerm}-${index}`}
                      vehicle={vehicle}
                      onHover={handleVehicleHover}
                      onLeave={handleVehicleLeave}
                    />
                  );
                });
              })()}
            </MapContainer>
          </Box>

          {/* Summary Sidebar */}
          <Box sx={{ width: 300, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.12)',
                backgroundColor: alpha(theme.palette.background.paper, 0.95)
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoIcon color="primary" />
                Vehicle Summary
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <SummaryCard
                  title="Recent (< 1 min)"
                  count={summary.recent}
                  color="#4caf50"
                  icon={<AccessTimeIcon sx={{ color: '#4caf50' }} />}
                />
                <SummaryCard
                  title="Moderate (1-5 min)"
                  count={summary.moderate}
                  color="#ff9800"
                  icon={<AccessTimeIcon sx={{ color: '#ff9800' }} />}
                />
                <SummaryCard
                  title="Old (> 5 min)"
                  count={summary.old}
                  color="#f44336"
                  icon={<AccessTimeIcon sx={{ color: '#f44336' }} />}
                />
                <SummaryCard
                  title="Total Vehicles"
                  count={summary.total}
                  color="#2196f3"
                  icon={<DirectionsBusIcon sx={{ color: '#2196f3' }} />}
                />
              </Box>
            </Paper>

            {/* Hovered Vehicle Details */}
            <Fade in={!!hoveredVehicle} timeout={300}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.12)',
                  backgroundColor: alpha(theme.palette.background.paper, 0.95),
                  border: `2px solid ${theme.palette.primary.main}`,
                  display: hoveredVehicle ? 'block' : 'none'
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Vehicle Details
                </Typography>
                {hoveredVehicle && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DirectionsBusIcon fontSize="small" color="action" />
                      <Typography variant="body2">
                        <strong>{hoveredVehicle.vehicleNo}</strong>
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AccessTimeIcon fontSize="small" color="action" />
                      <Typography variant="body2">
                        Route: {hoveredVehicle.routeNumber} ({hoveredVehicle.routeId})
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocationOnIcon fontSize="small" color="action" />
                      <Typography variant="body2">
                        Last ping: {new Date(hoveredVehicle.timestamp * 1000).toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocationOnIcon fontSize="small" color="action" />
                      <Typography variant="body2">
                        {hoveredVehicle.latitude.toFixed(6)}, {hoveredVehicle.longitude.toFixed(6)}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Paper>
            </Fade>
          </Box>
        </Box>
      </Box>
    </Layout>
  );
};

export default VehicleTracking;
