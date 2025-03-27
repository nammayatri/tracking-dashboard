import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import { Typography } from '@mui/material';
import { TrailPoint } from '../types';
import { createTrailPointIcon, formatTimestamp } from '../utils/helpers';

interface TrailPointMarkerProps {
  point: TrailPoint;
  color: string;
  index: number;
}

const TrailPointMarker: React.FC<TrailPointMarkerProps> = ({ point, color, index }) => {
  return (
    <Marker
      position={[point.lat, point.lng]}
      icon={createTrailPointIcon(color)}
      zIndexOffset={-100 + index} // Make sure latest points appear on top
    >
      <Popup>
        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
          Point #{index + 1}
        </Typography>
        <Typography variant="body2">
          Time: {formatTimestamp(point.timestamp)}
        </Typography>
        <Typography variant="body2">
          Coordinates: {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
        </Typography>
      </Popup>
    </Marker>
  );
};

export default TrailPointMarker; 