import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';

// MapController component to handle map events and updates
const MapController: React.FC = () => {
  const map = useMap();
  
  // Make the map instance available globally 
  useEffect(() => {
    console.log('MapController mounted, invalidating map size');
    // Force map to invalidate size and recalculate dimensions
    setTimeout(() => {
      map.invalidateSize();
      console.log('Map size invalidated');
      
      // Store map reference in a global variable
      (window as any).leafletMap = map;
    }, 100);
  }, [map]);
  
  return null;
};

export default MapController; 