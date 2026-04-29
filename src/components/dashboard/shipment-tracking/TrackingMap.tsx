
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer, TrafficLayer } from '@react-google-maps/api';
import { Loader2, MapPin, Truck, Navigation, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const MAPS_JS_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";
const DEFAULT_RUNNING_ICON = "https://png.pngtree.com/png-vector/20250122/ourlarge/pngtree-colorful-delivery-truck-icon-png-image_15301010.png";
const DEFAULT_STOPPED_ICON = "https://cdn-icons-png.flaticon.com/512/2555/2555013.png";

// Custom Mission Markers
const ORIGIN_ICON = "https://cdn-icons-png.flaticon.com/512/3061/3061341.png"; // Factory/Lifting Node
const DESTINATION_ICON = "https://cdn-icons-png.flaticon.com/512/2271/2271062.png"; // Warehouse/Drop Node

const libraries: ("places")[] = ['places'];

interface TrackingMapProps {
  vehicles?: any[];
  livePos?: any;
  origin?: string | { lat: number; lng: number; name: string };
  destination?: string | { lat: number; lng: number; name: string };
  originLabel?: string;
  destinationLabel?: string;
  height?: string;
  runningIconUrl?: string | null;
  stoppedIconUrl?: string | null;
}

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { 
      featureType: "road", 
      elementType: "geometry", 
      stylers: [{ color: "#485a71" }] 
    },
    { 
      featureType: "road", 
      elementType: "geometry.stroke", 
      stylers: [{ color: "#212a37" }] 
    },
    { 
      featureType: "road", 
      elementType: "labels.text.fill", 
      stylers: [{ color: "#9ca5b3" }] 
    },
    { 
      featureType: "road.highway", 
      elementType: "geometry", 
      stylers: [{ color: "#746855" }] 
    },
    { 
      featureType: "road.highway", 
      elementType: "geometry.stroke", 
      stylers: [{ color: "#1f2835" }] 
    },
    { 
      featureType: "road.highway", 
      elementType: "labels.text.fill", 
      stylers: [{ color: "#f3d19c" }] 
    },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  ],
};

export default function TrackingMap({ 
  vehicles = [], 
  livePos, 
  origin, 
  destination, 
  originLabel,
  destinationLabel,
  height = "500px",
  runningIconUrl,
  stoppedIconUrl
}: TrackingMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: MAPS_JS_KEY,
    libraries
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<any>(null);

  const runningIcon = runningIconUrl || DEFAULT_RUNNING_ICON;
  const stoppedIcon = stoppedIconUrl || DEFAULT_STOPPED_ICON;

  // Directions logic node: Resolve route from Origin to Destination
  useEffect(() => {
    if (!isLoaded || !origin || !destination) return;

    const directionsService = new google.maps.DirectionsService();
    
    // Mission Logic: Handle both Coordinate Nodes and Address Strings
    const originLocation = typeof origin === 'string' 
        ? origin 
        : (origin.lat && origin.lng ? { lat: origin.lat, lng: origin.lng } : null);
        
    const destinationLocation = typeof destination === 'string' 
        ? destination 
        : (destination.lat && destination.lng ? { lat: destination.lat, lng: destination.lng } : null);

    if (!originLocation || !destinationLocation) return;

    directionsService.route(
      {
        origin: originLocation,
        destination: destinationLocation,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          
          // Auto-adjust bounds to mission path
          if (map && !livePos) {
              const bounds = result.routes[0].bounds;
              map.fitBounds(bounds);
          }
        }
      }
    );
  }, [isLoaded, origin, destination, map, livePos]);

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const center = useMemo(() => {
    if (livePos) return { lat: livePos.latitude || livePos.lat, lng: livePos.longitude || livePos.lng };
    if (origin && typeof origin === 'object' && origin.lat) return { lat: origin.lat, lng: origin.lng };
    if (vehicles.length > 0) return { lat: vehicles[0].latitude || vehicles[0].lat, lng: vehicles[0].longitude || vehicles[0].lng };
    return { lat: 28.6139, lng: 77.2090 }; // Registry Default: Delhi Hub
  }, [livePos, origin, vehicles]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center bg-slate-900 rounded-3xl animate-pulse" style={{ height }}>
        <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="w-full relative overflow-hidden rounded-[2.5rem] border-4 border-white/5 shadow-2xl" style={{ height }}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={livePos || (origin && typeof origin === 'object') ? 12 : 6}
        onLoad={onMapLoad}
        options={mapOptions}
      >
        {/* Asset Marker: Original Satellite Location */}
        {livePos && (
          <Marker
            position={{ lat: livePos.latitude || livePos.lat, lng: livePos.longitude || livePos.lng }}
            icon={{
              url: (livePos.speed || 0) > 5 ? runningIcon : stoppedIcon,
              scaledSize: new google.maps.Size(42, 42),
              anchor: new google.maps.Point(21, 21),
            }}
            onClick={() => setSelectedMarker(livePos)}
            zIndex={100}
          />
        )}

        {/* Fleet Registry Markers */}
        {vehicles.map((v, i) => (
          <Marker
            key={i}
            position={{ lat: v.latitude || v.lat, lng: v.longitude || v.lng }}
            icon={{
              url: (v.speed || 0) > 5 ? runningIcon : stoppedIcon,
              scaledSize: new google.maps.Size(35, 35),
              anchor: new google.maps.Point(17, 17),
            }}
            onClick={() => setSelectedMarker(v)}
          />
        ))}

        {/* Mission Route Manifest */}
        {directions && (
          <>
            <DirectionsRenderer
                directions={directions}
                options={{
                    suppressMarkers: true,
                    polylineOptions: {
                        strokeColor: "#3b82f6",
                        strokeWeight: 7,
                        strokeOpacity: 0.8
                    }
                }}
            />
            {/* Start Node Marker */}
            <Marker 
                position={directions.routes[0].legs[0].start_location}
                icon={{
                    url: ORIGIN_ICON,
                    scaledSize: new google.maps.Size(40, 40),
                    anchor: new google.maps.Point(20, 40)
                }}
                label={{ 
                    text: originLabel || "Lifting Node", 
                    color: "white", 
                    fontSize: "11px", 
                    fontWeight: "900",
                    className: "bg-black/80 px-2 py-1 rounded-md shadow-xl border border-white/20"
                }}
            />
            {/* End Node Marker */}
            <Marker 
                position={directions.routes[0].legs[0].end_location}
                icon={{
                    url: DESTINATION_ICON,
                    scaledSize: new google.maps.Size(40, 40),
                    anchor: new google.maps.Point(20, 40)
                }}
                label={{ 
                    text: destinationLabel || "Drop Node", 
                    color: "white", 
                    fontSize: "11px", 
                    fontWeight: "900",
                    className: "bg-blue-600/90 px-2 py-1 rounded-md shadow-xl border border-white/20"
                }}
            />
          </>
        )}

        {selectedMarker && (
          <InfoWindow
            position={{ 
              lat: selectedMarker.latitude || selectedMarker.lat, 
              lng: selectedMarker.longitude || selectedMarker.lng 
            }}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="p-3 min-w-[220px] text-slate-900 bg-white rounded-lg">
              <p className="font-black text-xs uppercase border-b pb-2 mb-2 text-blue-900">{selectedMarker.vehicleNumber || selectedMarker.deviceNumber}</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-slate-400 uppercase">Speed:</span>
                  <span className="font-black text-slate-900">{selectedMarker.speed || 0} KM/H</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-slate-400 uppercase">Signal:</span>
                  <Badge className={cn(
                    "h-4 text-[8px] font-black uppercase border-none px-2",
                    (selectedMarker.speed || 0) > 5 ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                  )}>
                    {(selectedMarker.speed || 0) > 5 ? 'MOVING' : 'STOPPED'}
                  </Badge>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Satellite Registry Node</p>
                  <p className="text-[10px] font-bold text-slate-700 leading-tight uppercase">{selectedMarker.location || selectedMarker.address || 'Resolving...'}</p>
                </div>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
