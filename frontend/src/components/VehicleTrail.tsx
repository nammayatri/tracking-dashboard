import React from 'react';
import { Polyline } from 'react-leaflet';
import { VehicleData } from '../types';
import { calculateDistance, getVehicleColor } from '../utils/helpers';
import { MAX_POINT_DISTANCE_KM } from '../utils/constants';
import TrailPointMarker from './TrailPointMarker';

interface VehicleTrailProps {
  vehicle: VehicleData;
  isOffline: boolean;
  isSelected: boolean;
}

const VehicleTrail: React.FC<VehicleTrailProps> = ({ vehicle, isOffline, isSelected }) => {
  // First, ensure trail points are sorted by timestamp (oldest to newest)
  const sortedTrail = [...vehicle.trail].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const trailSegments: Array<[number, number][]> = [];
  let currentSegment: [number, number][] = [];
  
  // Build segments based on sorted timestamps and distance threshold
  for (let i = 0; i < sortedTrail.length; i++) {
    const point: [number, number] = [sortedTrail[i].lat, sortedTrail[i].lng];
    
    if (i === 0) {
      // Start a new segment with the first point
      currentSegment = [point];
    } else {
      // Check distance from previous point
      const prevPoint = sortedTrail[i-1];
      const distance = calculateDistance(
        prevPoint.lat, prevPoint.lng, 
        sortedTrail[i].lat, sortedTrail[i].lng
      );
      
      if (distance <= MAX_POINT_DISTANCE_KM) {
        // Add to current segment if within threshold
        currentSegment.push(point);
      } else {
        // Distance too large, end current segment and start a new one
        if (currentSegment.length > 0) {
          trailSegments.push([...currentSegment]);
        }
        currentSegment = [point];
      }
    }
  }
  
  // Add the last segment if it has points
  if (currentSegment.length > 0) {
    trailSegments.push(currentSegment);
  }
  
  const trailColor = isOffline ? '#EA4335' : getVehicleColor(vehicle.provider);

  return (
    <>
      {/* Draw the polyline for the trail */}
      {trailSegments.map((segment, index) => (
        <Polyline
          key={`${vehicle.deviceId}-segment-${index}`}
          positions={segment}
          color={trailColor}
          weight={isOffline ? 2 : 3}
          opacity={isOffline ? 0.4 : 0.6}
          dashArray={isOffline ? "4, 4" : undefined}
        />
      ))}
      
      {/* If the vehicle is selected, also render individual trail points with timestamps */}
      {isSelected && sortedTrail.map((point, index) => (
        <TrailPointMarker 
          key={`${vehicle.deviceId}-point-${index}`} 
          point={point} 
          color={trailColor}
          index={index}
        />
      ))}
    </>
  );
};

export default VehicleTrail; 