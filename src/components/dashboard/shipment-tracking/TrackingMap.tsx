
'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  GoogleMap, 
  useJsApiLoader, 
  Marker, 
  DirectionsRenderer,
  InfoWindow
} from '@react-google-maps/api';
import { Truck, MapPin, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

const GOOGLE_MAPS_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";
const DEFAULT_TRUCK_ICON = "https://png.pngtree.com/png-vector/20250122/ourlarge/pngtree-colorful-delivery-truck-icon-png-image_15301010.png";

const containerStyle = {
  width: "100%",
  height: "100%",
};

const defaultCenter = {
  lat: 28.6139,
  lng: 77.2090,
};

interface TrackingMapProps {
    livePos?: { lat: number; lng: number; speed: number; ignition: boolean; vehicleNumber?: string };
    origin?: { lat: number; lng: number; name?: string };
    destination?: { lat: number; lng: number; name?: string };
    fleet?: any[]; 
    tripId?: string;
    height?: string;
}

export default function TrackingMap({ livePos, origin, destination, fleet, tripId, height = "500px" }: TrackingMapProps) {
    const firestore = useFirestore();
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_KEY,
        libraries: ['places']
    });

    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
    const [isApiBlocked, setIsApiBlocked] = useState(false);
    const [selectedMarker, setSelectedMarker] = useState<any>(null);
    const [customIcon, setCustomIcon] = useState<string>(DEFAULT_TRUCK_ICON);

    // REGISTRY HANDSHAKE: Logic for single vehicle vs fleet view
    useEffect(() => {
        if (livePos) {
            setSelectedMarker(livePos);
        }
    }, [livePos]);

    // Registry Handshake: Fetch Custom Asset Icon
    useEffect(() => {
        if (!firestore) return;
        const fetchSettings = async () => {
            const snap = await getDoc(doc(firestore, "gps_settings", "wheelseye"));
            if (snap.exists() && snap.data().iconUrl) {
                setCustomIcon(snap.data().iconUrl);
            }
        };
        fetchSettings();
    }, [firestore]);

    // Initial Handshake Node
    useEffect(() => {
        if (!origin || !destination || !isLoaded || !window.google) return;

        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
            {
                origin: origin,
                destination: destination,
                travelMode: google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
                if (status === "OK") {
                    setDirections(result);
                }
            }
        );
    }, [origin, destination, isLoaded]);

    const zoomLevel = useMemo(() => {
        if (livePos) return 15;
        if (fleet && fleet.length > 0) return 5;
        return 8;
    }, [livePos, fleet]);

    if (loadError || isApiBlocked) {
        return (
            <div className="w-full bg-slate-900 rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-center text-white border-4 border-slate-800 shadow-2xl" style={{ height }}>
                <AlertTriangle className="h-12 w-12 text-amber-400 mb-4" />
                <h2 className="text-xl font-black uppercase tracking-tight italic">GIS Node Offline</h2>
                <p className="text-sm text-slate-400 mt-2 max-w-sm">Satellite synchronization failed. Please verify API configuration or connectivity.</p>
            </div>
        );
    }

    return (
        <div className="relative w-full rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white bg-slate-100" style={{ height }}>
            {isLoaded ? (
                <GoogleMap
                mapContainerStyle={containerStyle}
                center={
                    livePos?.latitude && livePos?.longitude 
                        ? { 
                            lat: Number(livePos.latitude), 
                            lng: Number(livePos.longitude) 
                          } 
                        : (origin?.lat ? origin : defaultCenter)
                }
                zoom={zoomLevel}
                options={{
                    disableDefaultUI: false,
                    zoomControl: true,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: true
                }}
            >
                    {/* F = FROM LOCATION */}
                    {origin && (
                        <Marker 
                            position={origin} 
                            label={{ text: "F", color: "white", fontWeight: "900" }}
                            title="Lifting Node (FROM)"
                        />
                    )}
                    
                    {/* D = DESTINATION */}
                    {destination && (
                        <Marker 
                            position={destination} 
                            label={{ text: "D", color: "white", fontWeight: "900" }}
                            title="Drop Destination (TO)"
                        />
                    )}

                    {/* V = VEHICLE (SINGLE TRIP) */}
                    {livePos && !fleet && (
                        <Marker 
                            position={livePos} 
                            icon={{
                                url: customIcon,
                                scaledSize: new google.maps.Size(45, 45),
                                anchor: new google.maps.Point(22, 22),
                            }}
                            title={`Live Asset: ${tripId}`}
                            onClick={() => setSelectedMarker(livePos)}
                        />
                    )}

                    {/* FLEET VIEW (DASHBOARD) */}
                    {fleet && fleet.map((v, i) => {
    // Sahi keys 'latitude' aur 'longitude' use karein aur Number mein badlein
    const lat = parseFloat(v.latitude);
    const lng = parseFloat(v.longitude);

    // Agar data invalid hai toh render skip karein taaki map crash na ho
    if (isNaN(lat) || isNaN(lng)) return null;

    return (
        <Marker 
            key={`${v.vehicleNumber}-${i}`} // Unique key for better performance
            position={{ lat, lng }} 
            icon={{
                path: "M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z", // Truck/Arrow shape
                fillColor: v.speed > 5 ? "#10b981" : "#ef4444", // Moving: Green, Idle: Red
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "#ffffff",
                scale: 1.5,
                rotation: parseInt(v.angle) || 0 // Vehicle direction
            }}
        />
    );
})}

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

{selectedMarker && (
    <InfoWindow
        position={{ 
            lat: Number(selectedMarker.latitude), 
            lng: Number(selectedMarker.longitude) 
        }}
        onCloseClick={() => setSelectedMarker(null)}
    >
        <div className="p-2 text-slate-900">
            <p className="font-bold text-xs uppercase">{selectedMarker.vehicleNumber}</p>
            <p className="text-[10px] text-slate-500">{selectedMarker.location}</p>
        </div>
    </InfoWindow>
)}
                </GoogleMap>
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-50 opacity-40">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
                    <p className="text-xs font-black uppercase tracking-widest">Syncing mission map node...</p>
                </div>
            )}
        </div>
    );
}
