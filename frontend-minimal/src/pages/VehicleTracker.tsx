import React, { useState, useEffect, useMemo } from 'react';
import {
  TextField,
  Button,
  Paper,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Card,
  CardContent,
  IconButton,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Tooltip,
  InputAdornment,
  Stack,
  useTheme,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  MenuItem
} from '@mui/material';
import { getVehicleRoute } from '../services/vehicleService';
import { RouteVehicle, ErrorResponse } from '../types/vehicle';
import VehicleMap from '../components/VehicleMap';
import Layout from '../components/Layout';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import RestoreIcon from '@mui/icons-material/Restore';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import SearchIcon from '@mui/icons-material/Search';
import MapIcon from '@mui/icons-material/Map';
import ViewListIcon from '@mui/icons-material/ViewList';
import RouteIcon from '@mui/icons-material/Route';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';

// Vehicle colors array - must match the array in VehicleMap component
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

// Add type definition for revenue data
interface RevenueData {
  busNumber: string;
  routeCode: string;
  day: string;
  revenue: number;
}

// Add RevenueReportModal component before the VehicleTracker component
const RevenueReportModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  // Generate one year of dummy data
  const generateYearlyData = (): RevenueData[] => {
    const data: RevenueData[] = [];
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');
    const busNumbers = ['TN01A1234', 'TN01A1235', 'TN01A1236', 'TN01A1237', 'TN01A1238'];
    const routeCodes = ['R001', 'R002', 'R003', 'R004', 'R005'];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      for (const busNumber of busNumbers) {
        const routeCode = routeCodes[Math.floor(Math.random() * routeCodes.length)];
        const revenue = Math.floor(Math.random() * (5000 - 1000) + 1000); // Random revenue between 1000 and 5000
        data.push({
          busNumber,
          routeCode,
          day: d.toISOString().split('T')[0],
          revenue
        });
      }
    }
    return data;
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBus, setSelectedBus] = useState<string>('');
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof RevenueData; direction: 'asc' | 'desc' }>({ key: 'day', direction: 'desc' });

  const allData = useMemo(() => generateYearlyData(), []);

  // Get unique values for filters
  const uniqueBuses = useMemo(() => Array.from(new Set(allData.map(item => item.busNumber))), [allData]);
  const uniqueRoutes = useMemo(() => Array.from(new Set(allData.map(item => item.routeCode))), [allData]);
  const uniqueMonths = useMemo(() => {
    const months = allData.map(item => item.day.substring(0, 7));
    return Array.from(new Set(months)).sort();
  }, [allData]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let filtered = allData;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.busNumber.toLowerCase().includes(searchLower) ||
        item.routeCode.toLowerCase().includes(searchLower)
      );
    }

    // Apply dropdown filters
    if (selectedBus) {
      filtered = filtered.filter(item => item.busNumber === selectedBus);
    }
    if (selectedRoute) {
      filtered = filtered.filter(item => item.routeCode === selectedRoute);
    }
    if (selectedMonth) {
      filtered = filtered.filter(item => item.day.startsWith(selectedMonth));
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      if (sortConfig.key === 'revenue') {
        return sortConfig.direction === 'asc' ? a.revenue - b.revenue : b.revenue - a.revenue;
      }
      return sortConfig.direction === 'asc'
        ? a[sortConfig.key].localeCompare(b[sortConfig.key])
        : b[sortConfig.key].localeCompare(a[sortConfig.key]);
    });
  }, [allData, searchTerm, selectedBus, selectedRoute, selectedMonth, sortConfig]);

  // Calculate total revenue for filtered data
  const totalRevenue = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + item.revenue, 0);
  }, [filteredData]);

  const handleSort = (key: keyof RevenueData) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Typography variant="h6" component="div" sx={{ mb: 1 }}>
          Revenue Collection Report
        </Typography>
        <Typography variant="subtitle2" color="text.secondary">
          Total Revenue: ₹{totalRevenue.toLocaleString()}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ overflow: 'hidden' }}>
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', paddingTop: 5 }}>
          <TextField
            label="Search"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            label="Bus Number"
            variant="outlined"
            size="small"
            value={selectedBus}
            onChange={(e) => setSelectedBus(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All Buses</MenuItem>
            {uniqueBuses.map((bus) => (
              <MenuItem key={bus} value={bus}>{bus}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Route Code"
            variant="outlined"
            size="small"
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All Routes</MenuItem>
            {uniqueRoutes.map((route) => (
              <MenuItem key={route} value={route}>{route}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Month"
            variant="outlined"
            size="small"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All Months</MenuItem>
            {uniqueMonths.map((month) => (
              <MenuItem key={month} value={month}>
                {new Date(month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell
                  onClick={() => handleSort('busNumber')}
                  sx={{ cursor: 'pointer' }}
                >
                  Bus Number {sortConfig.key === 'busNumber' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </TableCell>
                <TableCell
                  onClick={() => handleSort('routeCode')}
                  sx={{ cursor: 'pointer' }}
                >
                  Route Code {sortConfig.key === 'routeCode' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </TableCell>
                <TableCell
                  onClick={() => handleSort('day')}
                  sx={{ cursor: 'pointer' }}
                >
                  Day {sortConfig.key === 'day' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </TableCell>
                <TableCell
                  align="right"
                  onClick={() => handleSort('revenue')}
                  sx={{ cursor: 'pointer' }}
                >
                  Revenue Amount (₹) {sortConfig.key === 'revenue' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredData.map((row, index) => (
                <TableRow key={index} hover>
                  <TableCell>{row.busNumber}</TableCell>
                  <TableCell>{row.routeCode}</TableCell>
                  <TableCell>{new Date(row.day).toLocaleDateString()}</TableCell>
                  <TableCell align="right">{row.revenue.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const VehicleTracker: React.FC = () => {
  const theme = useTheme();
  const [routeId, setRouteId] = useState('');
  const [vehicles, setVehicles] = useState<RouteVehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(1); // Start with list view (1) instead of map view (0)
  const [enablePolling, setEnablePolling] = useState(false);
  const [showAllVehicles, setShowAllVehicles] = useState(false);
  const [revenueModalOpen, setRevenueModalOpen] = useState(false);

  // Assign colors to vehicles
  const vehiclesWithColors = useMemo(() => {
    return vehicles.map((vehicle, index) => ({
      ...vehicle,
      color: vehicleColors[index % vehicleColors.length],
      index: index + 1
    }));
  }, [vehicles]);

  // Get the selected vehicle with color information
  const selectedVehicle = useMemo(() => {
    return vehiclesWithColors.find(v => v.vehicleNumber === selectedVehicleId) || null;
  }, [vehiclesWithColors, selectedVehicleId]);

  // Filtered vehicles to display on map - either all or just the selected one
  const vehiclesToDisplay = useMemo(() => {
    if (showAllVehicles) {
      return vehiclesWithColors;
    } else {
      return selectedVehicle ? [selectedVehicle] : [];
    }
  }, [vehiclesWithColors, selectedVehicle, showAllVehicles]);

  const fetchVehicleData = async () => {
    if (!routeId) return;

    try {
      setIsLoading(true);
      setError(null);
      const response = await getVehicleRoute(routeId);

      if ('error' in response) {
        setError((response as ErrorResponse).message);
        setVehicles([]);
        setEnablePolling(false);
      } else {
        const newVehicles = response as RouteVehicle[];
        setVehicles(newVehicles);

        // Selection logic: preserve selection when possible
        if (selectedVehicleId) {
          // Check if current selection still exists in new data
          const vehicleStillExists = newVehicles.some(v => v.vehicleNumber === selectedVehicleId);
          if (!vehicleStillExists && newVehicles.length > 0) {
            // If selected vehicle no longer exists, select the first one
            console.log('Selected vehicle no longer exists, selecting first one');
            setSelectedVehicleId(newVehicles[0].vehicleNumber);
          }
          // If vehicle still exists, keep current selection (do nothing)
        } else if (newVehicles.length > 0) {
          // If no vehicle was selected but we have vehicles, select the first one
          setSelectedVehicleId(newVehicles[0].vehicleNumber);
        }

        setLastUpdated(new Date());
      }
    } catch (err) {
      setError('Failed to fetch vehicle data');
      setVehicles([]);
      setEnablePolling(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    // Only set up polling if explicitly enabled
    if (enablePolling && routeId) {
      // Set up polling every 10 seconds
      intervalId = setInterval(fetchVehicleData, 10000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [enablePolling, routeId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVehicleData();
    // Don't automatically enable polling
  };

  const handleTogglePolling = () => {
    const newValue = !enablePolling;
    setEnablePolling(newValue);

    // If we're enabling polling and we have a routeId
    if (newValue && routeId) {
      // If we have no vehicles or no selection yet, fetch data
      if (vehicles.length === 0 || !selectedVehicleId) {
        fetchVehicleData();
      }
      // If we already have vehicles and a selection, just update the last updated timestamp
      else {
        setLastUpdated(new Date());
        // Start the polling without changing selection
      }
    }
  };

  // Format time to display hours and minutes in a readable way
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSelectVehicle = (id: string) => {
    console.log('Selecting vehicle', id);
    setSelectedVehicleId(id);
    // If we're in list view, automatically switch to map view
    if (activeTab === 1) {
      setActiveTab(0);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Layout>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          pb: 3
        }}
      >
        {/* Search and Controls Card */}
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
              variant="h5"
              component="h1"
              gutterBottom={false}
              sx={{
                fontWeight: 500,
                color: 'text.primary',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <RouteIcon color="primary" />
              Vehicle Route Tracker
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} sx={{ p: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                label="Enter Route ID"
                placeholder="Example: 500A"
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                fullWidth
                variant="outlined"
                margin="normal"
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={isLoading}
                sx={{ mt: 2, height: 56 }}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Search'}
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<MonetizationOnIcon />}
                onClick={() => setRevenueModalOpen(true)}
                sx={{ mt: 2, height: 56, padding: '0 30px' }}
              >
                Revenue
              </Button>
              <Tooltip
                title="When enabled, data will refresh every 10 seconds. The currently selected vehicle will remain selected if still available."
                placement="top"
                arrow
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={enablePolling}
                      onChange={handleTogglePolling}
                      color="primary"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant={enablePolling ? "subtitle2" : "body2"} color={enablePolling ? "primary" : "text.secondary"}>
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AutorenewIcon fontSize="small" />
                          {enablePolling ? "Auto-refresh enabled" : "Auto-refresh disabled"}
                        </Box>
                      </Typography>
                      {enablePolling && selectedVehicleId && (
                        <Chip
                          size="small"
                          label="Tracking selected vehicle"
                          sx={{
                            ml: 1,
                            backgroundColor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                            fontWeight: 'medium'
                          }}
                        />
                      )}
                    </Box>
                  }
                />
              </Tooltip>
            </Stack>
          </Box>
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

        {vehicles.length > 0 && (
          <Paper
            elevation={0}
            sx={{
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.12)',
            }}
          >
            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              px: 3,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              backgroundColor: alpha(theme.palette.primary.main, 0.03)
            }}>
              <Typography variant="h6" color="text.primary">
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocalShippingIcon fontSize="small" color="primary" />
                  {vehicles.length} {vehicles.length === 1 ? 'Vehicle' : 'Vehicles'} on Route {routeId}
                </Box>
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {lastUpdated && (
                  <Typography variant="caption" color="text.secondary">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </Typography>
                )}
                <Tooltip title="Refresh now">
                  <IconButton
                    size="small"
                    onClick={fetchVehicleData}
                    color="primary"
                    disabled={isLoading}
                  >
                    <RestoreIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Tabs for map and list views */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                aria-label="vehicle view tabs"
                variant="fullWidth"
                sx={{
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    fontWeight: 500,
                    py: 1.5
                  }
                }}
              >
                <Tab
                  label="Map View"
                  icon={<MapIcon />}
                  iconPosition="start"
                />
                <Tab
                  label="Vehicle List"
                  icon={<ViewListIcon />}
                  iconPosition="start"
                />
              </Tabs>
            </Box>

            {/* Map View Tab */}
            {activeTab === 0 && (
              <Box sx={{ p: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1.5, backgroundColor: alpha(theme.palette.background.default, 0.6) }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showAllVehicles}
                        onChange={() => setShowAllVehicles(!showAllVehicles)}
                        color="primary"
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                        {showAllVehicles ? "Showing all vehicles" : "Showing selected vehicle only"}
                      </Typography>
                    }
                  />
                </Box>

                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, height: '600px' }}>
                  {/* Map container */}
                  <Box sx={{ flex: '1 1 auto', position: 'relative', height: { xs: '400px', md: '100%' } }}>
                    <VehicleMap
                      vehicles={vehiclesToDisplay}
                      selectedVehicleId={selectedVehicleId}
                      onSelectVehicle={handleSelectVehicle}
                    />
                  </Box>

                  {/* Side panel with vehicle details and ETA */}
                  {selectedVehicle && (
                    <Box
                      sx={{
                        width: { xs: '100%', md: '320px' },
                        height: { xs: 'auto', md: '100%' },
                        backgroundColor: alpha(theme.palette.background.paper, 0.98),
                        borderLeft: { xs: 'none', md: `1px solid ${alpha(theme.palette.divider, 0.1)}` },
                        borderTop: { xs: `1px solid ${alpha(theme.palette.divider, 0.1)}`, md: 'none' },
                        overflow: 'auto',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      {/* Vehicle header */}
                      <Box
                        sx={{
                          p: 2,
                          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                          backgroundColor: alpha(selectedVehicle.color, 0.05),
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          position: 'sticky',
                          top: 0,
                          zIndex: 10
                        }}
                      >
                        <Box
                          sx={{
                            backgroundColor: selectedVehicle.color,
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold',
                            boxShadow: `0 0 0 3px ${alpha(selectedVehicle.color, 0.2)}`
                          }}
                        >
                          {selectedVehicle.index}
                        </Box>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                            {selectedVehicle.vehicleNumber}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Route: <strong>{selectedVehicle.routeName}</strong>
                          </Typography>
                        </Box>
                      </Box>

                      {/* Vehicle Info */}
                      <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <DirectionsBusIcon sx={{ mr: 1.5, color: 'text.secondary', fontSize: 20 }} />
                            <Typography variant="body2">
                              Route ID: <strong>{selectedVehicle.routeId}</strong>
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <AccessTimeIcon sx={{ mr: 1.5, color: 'text.secondary', fontSize: 20 }} />
                            <Typography variant="body2">
                              Last seen: {new Date(selectedVehicle.lastSeen).toLocaleString()}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <LocationOnIcon sx={{ mr: 1.5, color: 'text.secondary', fontSize: 20 }} />
                            <Typography variant="body2">
                              {selectedVehicle.location.lat.toFixed(6)}, {selectedVehicle.location.lng.toFixed(6)}
                            </Typography>
                          </Box>

                          {selectedVehicle.trail.length > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                              <RouteIcon sx={{ mr: 1.5, color: 'text.secondary', fontSize: 20 }} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                  {selectedVehicle.trail.length} trail points
                                </Typography>
                                {selectedVehicle.trail.length >= 2 && (
                                  <Typography variant="caption" color="text.secondary">
                                    {new Date(
                                      [...selectedVehicle.trail].sort((a, b) =>
                                        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                                      )[0].timestamp
                                    ).toLocaleTimeString()} — {new Date(
                                      [...selectedVehicle.trail].sort((a, b) =>
                                        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                                      )[0].timestamp
                                    ).toLocaleTimeString()}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          )}
                        </Box>
                      </Box>

                      {/* ETA Section */}
                      <Box
                        sx={{
                          p: 2,
                          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                          backgroundColor: alpha(theme.palette.background.default, 0.3)
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{
                            color: selectedVehicle.color,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            mb: 1.5
                          }}
                        >
                          <AccessTimeIcon fontSize="small" />
                          ETA Information
                        </Typography>
                      </Box>

                      {/* Scrollable ETA List */}
                      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                        {selectedVehicle.etaData.length > 0 ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {selectedVehicle.etaData.map((eta, index) => (
                              <Box
                                key={index}
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  p: 1.5,
                                  borderRadius: 1.5,
                                  backgroundColor: alpha(selectedVehicle.color, 0.05),
                                  border: `1px solid ${alpha(selectedVehicle.color, 0.1)}`,
                                }}
                              >
                                <Box>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: 500,
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden'
                                    }}
                                  >
                                    {eta.stop_name}
                                  </Typography>

                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}
                                  >
                                    <AccessTimeIcon sx={{ fontSize: 14, mr: 0.5 }} />
                                    {new Date(eta.arrival_time * 1000).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </Typography>
                                </Box>

                                <Chip
                                  label={formatTime(eta.arrival_time)}
                                  size="small"
                                  sx={{
                                    backgroundColor: alpha(selectedVehicle.color, 0.15),
                                    color: 'text.primary',
                                    fontWeight: 'bold',
                                    borderRadius: 1,
                                    minWidth: 68,
                                    height: 28
                                  }}
                                />
                              </Box>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                            No ETA information available
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {/* List View Tab */}
            {activeTab === 1 && (
              <Box sx={{ p: 3, display: 'flex', flexWrap: 'wrap', gap: 3, backgroundColor: alpha(theme.palette.background.default, 0.4) }}>
                {vehiclesWithColors.map((vehicle) => (
                  <Box
                    key={vehicle.vehicleNumber}
                    sx={{
                      flex: '1 1 calc(50% - 24px)',
                      minWidth: '280px',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                      }
                    }}
                    onClick={() => handleSelectVehicle(vehicle.vehicleNumber)}
                  >
                    <Card sx={{
                      height: '100%',
                      borderRadius: 2,
                      boxShadow: vehicle.vehicleNumber === selectedVehicleId ?
                        `0 8px 16px ${alpha(vehicle.color, 0.2)}` : theme.shadows[1],
                      borderTop: `4px solid ${vehicle.color}`,
                      outline: vehicle.vehicleNumber === selectedVehicleId ?
                        `2px solid ${alpha(vehicle.color, 0.5)}` : 'none',
                      transition: 'all 0.3s ease',
                    }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Box
                            sx={{
                              backgroundColor: vehicle.color,
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: 'bold',
                              mr: 2,
                              boxShadow: vehicle.vehicleNumber === selectedVehicleId ?
                                `0 0 0 3px ${alpha(vehicle.color, 0.3)}` : 'none'
                            }}
                          >
                            {vehicle.index}
                          </Box>
                          <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                            {vehicle.vehicleNumber}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <DirectionsBusIcon sx={{ mr: 1, color: 'text.secondary' }} />
                            <Typography variant="body2">
                              Route: <strong>{vehicle.routeName}</strong>
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <AccessTimeIcon sx={{ mr: 1, color: 'text.secondary' }} />
                            <Typography variant="body2">
                              Last seen: {new Date(vehicle.lastSeen).toLocaleTimeString()}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <LocationOnIcon sx={{ mr: 1, color: 'text.secondary' }} />
                            <Typography variant="body2">
                              Location: {vehicle.location.lat.toFixed(4)}, {vehicle.location.lng.toFixed(4)}
                            </Typography>
                          </Box>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AccessTimeIcon fontSize="small" color="action" />
                          Next Stop
                        </Typography>
                        {vehicle.etaData.length > 0 ? (
                          <Box sx={{
                            p: 1.5,
                            backgroundColor: alpha(vehicle.color, 0.05),
                            borderRadius: 1.5,
                            display: 'flex',
                            justifyContent: 'space-between',
                            border: `1px solid ${alpha(vehicle.color, 0.1)}`,
                          }}>
                            <Typography variant="body2">
                              {vehicle.etaData[0].stop_name}
                            </Typography>
                            <Chip
                              label={formatTime(vehicle.etaData[0].arrival_time)}
                              size="small"
                              sx={{
                                backgroundColor: alpha(vehicle.color, 0.15),
                                fontWeight: 'bold',
                                borderRadius: 1
                              }}
                            />
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No ETA information available
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        )}

        {/* Add RevenueReportModal */}
        <RevenueReportModal
          open={revenueModalOpen}
          onClose={() => setRevenueModalOpen(false)}
        />
      </Box>
    </Layout>
  );
};

export default VehicleTracker; 