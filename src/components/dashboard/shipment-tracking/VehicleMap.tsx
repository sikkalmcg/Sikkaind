'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  GoogleMap, 
  useJsApiLoader, 
  Marker, 
  InfoWindow,
  DirectionsRenderer
} from '@react-google-maps/api';
import { Loader2, Truck, MapPin, Activity, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { fetchWheelseyeLocation } from '@/app/actions/wheelseye';

const GOOGLE_MAPS_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";
const DEFAULT_TRUCK_ICON = "https://png.pngtree.com/png-vector/20250122/ourlarge/pngtree-colorful-delivery-truck-icon-png-image_15301010.png";

interface MapProps {
  vehicleNo: string;
  origin?: { lat: number; lng: number; name?: string };
  destination?: { lat: number; lng: number; name?: string };
  runningIconUrl?: string | null;
  stoppedIconUrl?: string | null;
}

export default function VehicleMap({ 
    vehicleNo, 
    origin, 
    destination, 
    runningIconUrl,
    stoppedIconUrl
}: MapProps) {
  const firestore = useFirestore();
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: ['places', 'marker']
  });

  const [liveData, setLiveData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [isApiInvalid, setIsApiInvalid] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const fetchLocation = async () => {
    try {
      const res = await fetchWheelseyeLocation(vehicleNo);
      if (res.data) {
        setLiveData(res.data);
      }
    } catch (e) {
      console.error("GIS Sync Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocation();
    const interval = setInterval(fetchLocation, 30000);
    return () => clearInterval(interval);
  }, [vehicleNo]);

  useEffect(() => {
    if (!isLoaded || !origin || !destination) return;

    const service = new google.maps.DirectionsService();
    service.route({
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
        if (status === 'OK') setDirections(result);
    });
  }, [isLoaded, origin, destination]);

  const vehiclePos = useMemo(() => {
    if (!liveData) return null;
    return { 
      lat: parseFloat(liveData.latitude || liveData.lat), 
      lng: parseFloat(liveData.longitude || liveData.lng) 
    };
  }, [liveData]);

  const isMoving = (liveData?.speed || 0) > 5;
  const statusColor = !liveData?.ignition ? "text-slate-400" : (isMoving ? "text-emerald-500" : "text-red-500");

  if (loadError || isApiInvalid) {
      return (
          <div className="w-full h-[500px] bg-slate-900 rounded-[3rem] flex flex-col items-center justify-center p-8 text-center text-white border-4 border-slate-800">
              <AlertTriangle className="h-12 w-12 text-amber-400 mb-4" />
              <h2 className="text-xl font-black uppercase tracking-tight italic">GIS Node Offline</h2>
              <p className="text-sm text-slate-400 mt-2 max-w-sm">The Satellite Map registry is currently blocked or restricted. Please contact mission control to verify GIS authorization tokens.</p>
          </div>
      );
  }

  return (
    <div className="relative w-full h-[500px] rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white bg-slate-100">
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={vehiclePos || origin || { lat: 28.6139, lng: 77.2090 }}
          zoom={10}
          options={{ disableDefaultUI: false, gestureHandling: 'greedy' }}
          mapId="8a76e73364223c34"
        >
          {origin && <Marker position={origin} title="Lifting Source" />}
          {destination && <Marker position={destination} title="Drop Destination" />}
          
          {vehiclePos && (
            <Marker 
                position={vehiclePos} 
                onClick={() => setInfoOpen(true)}
                icon={{
                    url: (isMoving ? runningIconUrl : stoppedIconUrl) || DEFAULT_TRUCK_ICON,
                    scaledSize: new window.google.maps.Size(48, 48)
                }}
            />
          )}

          {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true }} />}
          
          {infoOpen && vehiclePos && (
            <InfoWindow position={vehiclePos} onCloseClick={() => setInfoOpen(false)}>
              <div className="p-2 min-w-[200px] space-y-3 text-slate-900 bg-white">
                <div className="flex items-center gap-2 border-b pb-2">
                    <Truck className="h-4 w-4 text-blue-600" />
                    <span className="font-black uppercase text-xs">{vehicleNo}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Speed</p>
                        <p className="text-sm font-black text-slate-900">{liveData?.speed} KM/H</p>
                    </div>
                    <div className="spacey-0.5">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Ignition</p>
                        <p className={cn("text-sm font-black uppercase", statusColor)}>
                            {liveData?.ignition ? 'ON' : 'OFF'}
                        </p>
                    </div>
                </div>
                <div className="pt-2 border-t flex items-center gap-2">
                    <Clock className="h-3 w-3 text-slate-300" />
                    <span className="text-[9px] font-bold text-slate-400">{liveData?.lastUpdate || liveData?.createdDateReadable}</span>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      ) : (
        <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-900 animate-pulse">GIS Handshake Active...</span>
            </div>
        </div>
      )}
    </div>
  );
}
