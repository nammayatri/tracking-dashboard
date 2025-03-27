import { useState, useRef, useCallback, useEffect } from 'react';
import { VehicleData, TrailPoint } from '../types';
import { TIME_SCALE } from '../utils/constants';

interface UsePlaybackResult {
  isPlaying: boolean;
  playbackPosition: number;
  playbackSpeed: number;
  currentPointIndex: number;
  sortedTrailPoints: TrailPoint[];
  animationVehicle: VehicleData | null;
  handleVehicleSelect: (deviceId: string, vehicles: VehicleData[]) => void;
  startPlayback: () => void;
  stopPlayback: () => void;
  resetPlayback: () => void;
  togglePlayback: () => void;
  handlePlaybackPositionChange: (event: Event, newValue: number | number[]) => void;
  handleSpeedChange: () => void;
  getCurrentPoint: () => TrailPoint | null;
  calculateTrailDuration: () => number;
  formatPlaybackTime: (positionPercent: number) => string;
}

const usePlayback = (): UsePlaybackResult => {
  // Animation states for bus playback
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackPosition, setPlaybackPosition] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x, 2x, 4x speeds
  const [animationVehicle, setAnimationVehicle] = useState<VehicleData | null>(null);
  const [sortedTrailPoints, setSortedTrailPoints] = useState<TrailPoint[]>([]);
  const [currentPointIndex, setCurrentPointIndex] = useState<number>(0);
  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);

  // Calculate total duration of the trail in milliseconds
  const calculateTrailDuration = useCallback(() => {
    if (sortedTrailPoints.length < 2) return 0;
    
    const startTime = new Date(sortedTrailPoints[0].timestamp).getTime();
    const endTime = new Date(sortedTrailPoints[sortedTrailPoints.length - 1].timestamp).getTime();
    
    return endTime - startTime;
  }, [sortedTrailPoints]);
  
  // Get current position in the trail based on playback position (0-100)
  const getCurrentPoint = useCallback(() => {
    if (sortedTrailPoints.length === 0) return null;
    
    if (playbackPosition <= 0) return sortedTrailPoints[0];
    if (playbackPosition >= 100) return sortedTrailPoints[sortedTrailPoints.length - 1];
    
    const totalDuration = calculateTrailDuration();
    if (totalDuration === 0) return sortedTrailPoints[0];
    
    const currentTimePosition = (playbackPosition / 100) * totalDuration;
    const startTime = new Date(sortedTrailPoints[0].timestamp).getTime();
    const targetTime = startTime + currentTimePosition;
    
    // Find the closest point based on time
    let closestIndex = 0;
    let closestDiff = Number.MAX_SAFE_INTEGER;
    
    sortedTrailPoints.forEach((point, index) => {
      const pointTime = new Date(point.timestamp).getTime();
      const diff = Math.abs(pointTime - targetTime);
      
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = index;
      }
    });
    
    setCurrentPointIndex(closestIndex);
    return sortedTrailPoints[closestIndex];
  }, [sortedTrailPoints, playbackPosition, calculateTrailDuration]);
  
  // Format playback time
  const formatPlaybackTime = useCallback((positionPercent: number) => {
    if (sortedTrailPoints.length < 2) return "00:00";
    
    const totalDuration = calculateTrailDuration();
    const currentMs = (positionPercent / 100) * totalDuration;
    
    // Convert to minutes and seconds
    const totalSeconds = Math.floor(currentMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [sortedTrailPoints, calculateTrailDuration]);
  
  // Start playback animation
  const startPlayback = useCallback(() => {
    if (animationRef.current !== null || !animationVehicle || sortedTrailPoints.length < 2) {
      return;
    }
    
    const totalDuration = calculateTrailDuration();
    if (totalDuration === 0) return;
    
    // If at the end, reset to beginning
    if (playbackPosition >= 100) {
      setPlaybackPosition(0);
      setCurrentPointIndex(0);
    }
    
    setIsPlaying(true);
    lastFrameTimeRef.current = performance.now();
    
    const animate = (timestamp: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      
      const elapsed = timestamp - lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;
      
      // Apply playback speed and time scale
      const effectiveElapsed = elapsed * playbackSpeed * (1000 / (TIME_SCALE * 1000));
      
      // Calculate new position
      const newPosition = playbackPosition + (effectiveElapsed / totalDuration) * 100;
      
      if (newPosition >= 100) {
        // End of playback
        setPlaybackPosition(100);
        setIsPlaying(false);
        setCurrentPointIndex(sortedTrailPoints.length - 1);
        animationRef.current = null;
        lastFrameTimeRef.current = null;
        return;
      }
      
      setPlaybackPosition(newPosition);
      getCurrentPoint(); // This updates the currentPointIndex
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
  }, [animationVehicle, sortedTrailPoints, playbackPosition, calculateTrailDuration, getCurrentPoint, playbackSpeed]);
  
  // Stop playback animation
  const stopPlayback = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      lastFrameTimeRef.current = null;
    }
    setIsPlaying(false);
  }, []);
  
  // Reset playback to beginning
  const resetPlayback = useCallback(() => {
    stopPlayback();
    setPlaybackPosition(0);
    setCurrentPointIndex(0);
  }, [stopPlayback]);
  
  // Toggle playback
  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, startPlayback, stopPlayback]);
  
  // Handle playback slider change
  const handlePlaybackPositionChange = useCallback((event: Event, newValue: number | number[]) => {
    const position = newValue as number;
    stopPlayback();
    setPlaybackPosition(position);
    getCurrentPoint();
  }, [stopPlayback, getCurrentPoint]);
  
  // Change playback speed
  const handleSpeedChange = useCallback(() => {
    // Cycle through speeds: 1x -> 2x -> 4x -> 1x
    setPlaybackSpeed(prevSpeed => {
      if (prevSpeed === 1) return 2;
      if (prevSpeed === 2) return 4;
      return 1;
    });
  }, []);
  
  // Handle vehicle selection for playback
  const handleVehicleSelect = useCallback((deviceId: string, vehicles: VehicleData[]) => {
    // First stop any existing playback
    stopPlayback();
    
    // Find selected vehicle
    const foundVehicle = vehicles.find(v => v.deviceId === deviceId);
    
    if (foundVehicle) {
      console.log(`Found vehicle ${deviceId} with ${foundVehicle.trail?.length || 0} trail points`);
      
      // Always set the animation vehicle regardless of trail points
      setAnimationVehicle(foundVehicle);
      
      // Generate demo data if no trail points or only one point
      if (!foundVehicle.trail || foundVehicle.trail.length < 2) {
        console.log('Not enough trail points, generating mock data');
        
        // Start with existing point or default
        const basePoint = foundVehicle.trail && foundVehicle.trail.length > 0 
          ? foundVehicle.trail[0] 
          : { 
              lat: 12.9716, 
              lng: 77.5946, 
              timestamp: new Date().toISOString() 
            };
            
        // Generate 10 mock trail points
        const mockTrail = Array.from({ length: 10 }, (_, i) => {
          return {
            lat: Number(basePoint.lat) + (i * 0.0005),
            lng: Number(basePoint.lng) + (i * 0.0005),
            timestamp: new Date(Date.now() - (9-i) * 5 * 60000).toISOString()
          };
        });
        
        console.log(`Generated ${mockTrail.length} mock trail points`);
        setSortedTrailPoints(mockTrail);
        setCurrentPointIndex(0);
        setPlaybackPosition(0);
        return;
      }
      
      try {
        // Create a safe copy with explicit number conversion to avoid issues
        const trailCopy = foundVehicle.trail.map(point => ({
          lat: typeof point.lat === 'string' ? parseFloat(point.lat) : Number(point.lat),
          lng: typeof point.lng === 'string' ? parseFloat(point.lng) : Number(point.lng),
          timestamp: point.timestamp
        }));
        
        console.log(`Made trail copy with ${trailCopy.length} points`);
        
        // Sort trail points by timestamp (oldest to newest)
        const sorted = [...trailCopy].sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeA - timeB;
        });
        
        console.log(`Sorted ${sorted.length} trail points`);
        
        if (sorted.length >= 2) {
          setSortedTrailPoints(sorted);
          setCurrentPointIndex(0);
          setPlaybackPosition(0);
        } else {
          // Not enough points after processing, generate mock data
          console.log('Not enough valid trail points after processing, using mock data');
          
          const basePoint = sorted.length > 0 ? sorted[0] : {
            lat: 12.9716, 
            lng: 77.5946, 
            timestamp: new Date().toISOString()
          };
          
          const mockTrail = Array.from({ length: 10 }, (_, i) => {
            return {
              lat: basePoint.lat + (i * 0.0005),
              lng: basePoint.lng + (i * 0.0005),
              timestamp: new Date(Date.now() - (9-i) * 5 * 60000).toISOString()
            };
          });
          
          console.log(`Generated ${mockTrail.length} mock trail points`);
          setSortedTrailPoints(mockTrail);
          setCurrentPointIndex(0);
          setPlaybackPosition(0);
        }
      } catch (error) {
        console.error('Error processing trail points:', error);
        
        // Generate mock data on error
        console.log('Error in trail processing, using mock data');
        const mockTrail = Array.from({ length: 10 }, (_, i) => {
          return {
            lat: 12.9716 + (i * 0.0005),
            lng: 77.5946 + (i * 0.0005),
            timestamp: new Date(Date.now() - (9-i) * 5 * 60000).toISOString()
          };
        });
        
        setSortedTrailPoints(mockTrail);
        setCurrentPointIndex(0);
        setPlaybackPosition(0);
      }
    } else {
      console.log(`Vehicle with ID ${deviceId} not found, using demo data`);
      
      // Generate mock data for demo
      const mockTrail = Array.from({ length: 10 }, (_, i) => {
        return {
          lat: 12.9716 + (i * 0.0005),
          lng: 77.5946 + (i * 0.0005),
          timestamp: new Date(Date.now() - (9-i) * 5 * 60000).toISOString()
        };
      });
      
      setSortedTrailPoints(mockTrail);
      setCurrentPointIndex(0);
      setPlaybackPosition(0);
    }
  }, [stopPlayback]);
  
  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    isPlaying,
    playbackPosition,
    playbackSpeed,
    currentPointIndex,
    sortedTrailPoints,
    animationVehicle,
    handleVehicleSelect,
    startPlayback,
    stopPlayback,
    resetPlayback,
    togglePlayback,
    handlePlaybackPositionChange,
    handleSpeedChange,
    getCurrentPoint,
    calculateTrailDuration,
    formatPlaybackTime
  };
};

export default usePlayback; 