import React from 'react';
import { 
  Box, 
  Button, 
  Paper, 
  Typography, 
  Slider, 
  Alert 
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SpeedIcon from '@mui/icons-material/Speed';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import ClearIcon from '@mui/icons-material/Clear';
import { VehicleData, TrailPoint } from '../types';
import { formatTimestamp } from '../utils/helpers';

interface PlaybackControlsProps {
  selectedVehicle: string | null;
  animationVehicle: VehicleData | null;
  sortedTrailPoints: TrailPoint[];
  playbackPosition: number;
  currentPointIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onPlaybackPositionChange: (event: Event, newValue: number | number[]) => void;
  onTogglePlayback: () => void;
  onResetPlayback: () => void;
  onSpeedChange: () => void;
  onClearSelection: () => void;
  formatPlaybackTime: (positionPercent: number) => string;
  generateMockTrailPoints: (basePoint: TrailPoint, count: number) => void;
}

const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  selectedVehicle,
  animationVehicle,
  sortedTrailPoints,
  playbackPosition,
  currentPointIndex,
  isPlaying,
  playbackSpeed,
  onPlaybackPositionChange,
  onTogglePlayback,
  onResetPlayback,
  onSpeedChange,
  onClearSelection,
  formatPlaybackTime,
  generateMockTrailPoints
}) => {
  if (!selectedVehicle) return null;

  const handleGenerateMockData = () => {
    const basePoint = animationVehicle?.trail[0] || { 
      lat: 12.9716, 
      lng: 77.5946, 
      timestamp: new Date().toISOString() 
    };
    
    generateMockTrailPoints(basePoint, 10);
  };

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: '700px',
        p: 2,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.97)',
        zIndex: 1500,
        border: '2px solid #4285F4',
        boxShadow: '0 6px 12px rgba(0,0,0,0.2)'
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
          <DirectionsBusIcon sx={{ mr: 1, color: 'primary.main' }} />
          {animationVehicle?.vehicleNumber || 'Vehicle'} Journey Details
        </Typography>
        
        {sortedTrailPoints.length <= 1 ? (
          <Box sx={{ my: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Not enough data points available for playback. Playback requires at least 2 trail points.
              (Found: {sortedTrailPoints.length} points, Vehicle has {animationVehicle?.trail?.length || 0} original points)
            </Alert>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Vehicle Number: {animationVehicle?.vehicleNumber || 'Unknown'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Route: {animationVehicle?.routeNumber || 'Unknown'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Provider: {animationVehicle?.provider || 'Unknown'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Trail Points: {animationVehicle?.trail?.length || 0}
              </Typography>
            </Box>
            {animationVehicle?.trail && animationVehicle.trail.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Button 
                  variant="contained"
                  color="secondary"
                  onClick={handleGenerateMockData}
                  fullWidth
                >
                  Use Demo Data (10 points)
                </Button>
              </Box>
            )}
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                Start: {formatTimestamp(sortedTrailPoints[0]?.timestamp || '')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                End: {formatTimestamp(sortedTrailPoints[sortedTrailPoints.length-1]?.timestamp || '')}
              </Typography>
            </Box>
            <Slider
              value={playbackPosition}
              onChange={onPlaybackPositionChange}
              aria-labelledby="playback-slider"
              valueLabelDisplay="auto"
              valueLabelFormat={() => formatPlaybackTime(playbackPosition)}
              step={0.1}
              min={0}
              max={100}
              sx={{ 
                mb: 1,
                height: 8,
                '& .MuiSlider-thumb': {
                  width: 16,
                  height: 16,
                  '&:before': {
                    boxShadow: '0 0 1px 0 rgba(0,0,0,0.3)'
                  },
                  '&:hover, &.Mui-focusVisible': {
                    boxShadow: '0px 0px 0px 8px rgba(66, 133, 244, 0.16)'
                  }
                },
                '& .MuiSlider-rail': {
                  opacity: 0.5,
                }
              }}
            />
          </>
        )}
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary' }}>
            {sortedTrailPoints.length > 1 ? `Points: ${currentPointIndex + 1}/${sortedTrailPoints.length} • Time Scale: 1s = 20s` : ''}
          </Typography>
        </Box>
        {sortedTrailPoints.length > 1 && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button 
              variant="outlined"
              onClick={onResetPlayback}
              startIcon={<RestartAltIcon />}
              sx={{ minWidth: '100px' }}
            >
              Reset
            </Button>
            <Button 
              variant="outlined"
              onClick={onSpeedChange}
              startIcon={<SpeedIcon />}
              sx={{ minWidth: '100px' }}
            >
              {playbackSpeed}x
            </Button>
            <Button 
              variant="contained"
              onClick={onTogglePlayback}
              startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
              color="primary"
              size="large"
              sx={{ 
                minWidth: '120px',
                fontWeight: 'bold'
              }}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
          </Box>
        )}
        {sortedTrailPoints.length <= 1 && (
          <Button 
            variant="outlined"
            onClick={onClearSelection}
            startIcon={<ClearIcon />}
          >
            Close Details
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default PlaybackControls; 