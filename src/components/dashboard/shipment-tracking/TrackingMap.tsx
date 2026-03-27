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

const libraries: ("places")[] = ['places'];

interface TrackingMapProps {
  vehicles?: any[];
  livePos?: any;
  origin?: { lat: number; lng: number; name: string };
  destination?: string | { lat: number; lng: number; name: string };
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
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  ],
};

export default function TrackingMap({ 
  vehicles = [], 
  livePos, 
  origin, 
  destination, 
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

  // Directions logic
  useEffect(() => {
    if (!isLoaded || !origin || !destination) return;

    const directionsService = new google.maps.DirectionsService();
    const dest = typeof destination === 'string' ? destination : { lat: destination.lat, lng: destination.lng };

    directionsService.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: dest,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
        }
      }
    );
  }, [isLoaded, origin, destination]);

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const center = useMemo(() => {
    if (livePos) return { lat: livePos.latitude || livePos.lat, lng: livePos.longitude || livePos.lng };
    if (origin) return { lat: origin.lat, lng: origin.lng };
    if (vehicles.length > 0) return { lat: vehicles[0].latitude || vehicles[0].lat, lng: vehicles[0].longitude || vehicles[0].lng };
    return { lat: 28.6139, lng: 77.2090 }; // Delhi
  }, [livePos, origin, vehicles]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center bg-slate-100 rounded-2xl animate-pulse" style={{ height }}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-900" />
      </div>
    );
  }

  return (
    <div className="w-full relative overflow-hidden rounded-[2rem] border-4 border-white shadow-xl" style={{ height }}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={livePos || origin ? 12 : 6}
        onLoad={onMapLoad}
        options={mapOptions}
      >
        {/* Single Vehicle Mode (livePos) */}
        {livePos && (
          <Marker
            position={{ lat: livePos.latitude || livePos.lat, lng: livePos.longitude || livePos.lng }}
            icon={{
              url: livePos.speed > 5 ? runningIcon : stoppedIcon,
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 20),
            }}
            onClick={() => setSelectedMarker(livePos)}
          />
        )}

        {/* Fleet Mode (vehicles) */}
        {vehicles.map((v, i) => (
          <Marker
            key={i}
            position={{ lat: v.latitude || v.lat, lng: v.longitude || v.lng }}
            icon={{
              url: v.speed > 5 ? runningIcon : stoppedIcon,
              scaledSize: new google.maps.Size(35, 35),
              anchor: new google.maps.Point(17, 17),
            }}
            onClick={() => setSelectedMarker(v)}
          />
        ))}

        {/* Directions */}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: "#3b82f6",
                strokeWeight: 5,
                strokeOpacity: 0.8
              }
            }}
          />
        )}

        {/* Origin/Dest Markers for Directions */}
        {origin && (
          <Marker 
            position={{ lat: origin.lat, lng: origin.lng }}
            label={{ text: "Dispatch", color: "white", fontSize: "10px", fontWeight: "bold" }}
          />
        )}

        {selectedMarker && (
          <InfoWindow
            position={{ 
              lat: selectedMarker.latitude || selectedMarker.lat, 
              lng: selectedMarker.longitude || selectedMarker.lng 
            }}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="p-2 min-w-[200px] text-slate-900 bg-white">
              <p className="font-black text-xs uppercase border-b pb-1 mb-2">{selectedMarker.vehicleNumber || selectedMarker.deviceNumber}</p>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-slate-400">Speed:</span>
                  <span className="font-black text-blue-900">{selectedMarker.speed || 0} KM/H</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-slate-400">Status:</span>
                  <Badge className={cn(
                    "h-4 text-[8px] font-black uppercase border-none",
                    selectedMarker.speed > 5 ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                  )}>
                    {selectedMarker.speed > 5 ? 'MOVING' : 'STOPPED'}
                  </Badge>
                </div>
                <div className="pt-1.5 border-t">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Location Registry</p>
                  <p className="text-[10px] font-bold text-slate-700 leading-tight uppercase">{selectedMarker.location || selectedMarker.address || 'Syncing...'}</p>
                </div>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
