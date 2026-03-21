import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/firebase";

/**
 * @fileOverview Hardened GIS Utility for Wheelseye Handshake.
 * Performs secure extraction of telemetry nodes from the authorized gateway.
 * Implements address cleaning logic to resolve professional location names.
 * Integrated with Google Maps Reverse Geocoding for high-fidelity location registry.
 * Note: 'use server' removed to support static export client-side execution.
 */

const GOOGLE_MAPS_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";

/**
 * Reverse Geocoding Node: Converts lat/lng coordinates to a human-readable address.
 */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}`;
        const response = await fetch(url); 
        const data = await response.json();
        
        if (data.status === 'OK' && data.results.length > 0) {
            return data.results[0].formatted_address;
        }
    } catch (e) {
        console.error("Satellite Geocoding Handshake Failure:", e);
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/**
 * Registry Logic: Cleans raw address data into professional 'Location Registry' format.
 */
function cleanLocationRegistry(address: string): string {
    if (!address || address === 'N/A') return 'Location Registry Sync...';
    
    const forbidden = ["Registry", "Handshake", "Node", "Transit Interchange", "Cluster Perimeter", "Near En-route", "En-route", "Mission Transit"];
    let clean = address;
    forbidden.forEach(word => {
        const regex = new RegExp(word, 'gi');
        clean = clean.replace(regex, '');
    });

    const parts = clean.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
        return `${parts[0]}, ${parts[1]}, ${parts[2]}`;
    } else if (parts.length > 0) {
        return parts.join(', ');
    }
    return 'Location Registry Sync...';
}

async function getSettings() {
    try {
        const settingsRef = doc(firestore, "gps_settings", "wheelseye");
        const snap = await getDoc(settingsRef);
        if (snap.exists()) return snap.data();
    } catch (e) {
        console.warn("Using default GIS settings node.");
    }
    return {
        apiUrl: "https://api.wheelseye.com/currentLoc",
        accessToken: "53afc208-0981-48c7-b134-d85d2f33dc0c"
    };
}

export async function fetchFleetLocation() {
  const settings = await getSettings();
  const url = `${settings.apiUrl}?accessToken=${settings.accessToken}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) return { data: [], error: "Gateway Registry Unreachable" };

    const result = await response.json();
    const list = result?.data?.list || result?.data || [];
    
    if (!Array.isArray(list)) return { data: [], error: "Invalid Telemetry Format" };

    const processedPromises = list.map(async (v: any) => {
        let rawLoc = v.address || v.location || v.currentLocation || v.last_location || v.current_location || v.lastUpdateAddress || v.formattedAddress;
        const lastUpdateStr = v.createdDate || v.lastUpdate || v.last_updated_time || new Date().toISOString();
        
        const lat = parseFloat(v.latitude || v.lat);
        const lng = parseFloat(v.longitude || v.lng || v.long);

        if ((!rawLoc || rawLoc === 'N/A' || rawLoc.toLowerCase().includes('mission transit')) && !isNaN(lat) && !isNaN(lng)) {
            rawLoc = await reverseGeocode(lat, lng);
        }

        return {
            vehicleNumber: v.vehicleNumber?.toUpperCase().replace(/\s/g, '') || v.vehicleNo,
            deviceNumber: v.deviceNumber || v.imei || '',
            lat,
            lng,
            speed: Number(v.speed || 0),
            ignition: v.ignition === true || v.ignition === 'true' || v.ignition === 'on',
            angle: Number(v.angle || 0),
            lastUpdate: v.createdDateReadable || v.lastUpdate || new Date().toLocaleString(),
            lastUpdateRaw: lastUpdateStr,
            provider: v.provider || 'Wheelseye',
            vehicleType: v.vehicleType || 'Truck',
            location: cleanLocationRegistry(rawLoc || 'N/A'),
            last_stop_time: v.last_stop_time || v.lastStopTime || (Number(v.speed || 0) <= 5 ? new Date(Date.now() - 3600000).toISOString() : null)
        };
    });
    
    const processed = await Promise.all(processedPromises);
    return { data: processed, error: null };
  } catch (error) {
    return { data: [], error: "Critical: Connection to Terminal failed." };
  }
}

export async function fetchWheelseyeLocation(vehicleNumber: string) {
  const settings = await getSettings();
  const cleanNo = vehicleNumber?.toUpperCase().replace(/\s/g, '');
  const url = `${settings.apiUrl}?accessToken=${settings.accessToken}&vehicleNo=${cleanNo}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) return { data: null, error: "Gateway Unreachable" };

    const result = await response.json();
    
    if (result && result.data) {
        let v = null;
        if (result.data.list && Array.isArray(result.data.list)) {
            v = result.data.list.find((item: any) => item.vehicleNumber?.toUpperCase().replace(/\s/g, '') === cleanNo) || result.data.list[0];
        } else {
            v = Array.isArray(result.data) ? result.data[0] : result.data;
        }

        if (!v) return { data: null, error: "Vehicle not found in live stream." };

        let rawLoc = v.address || v.location || v.currentLocation || v.last_location || v.current_location || v.lastUpdateAddress || v.formattedAddress;
        const lastUpdateStr = v.createdDate || v.lastUpdate || v.last_updated_time || new Date().toISOString();

        const lat = parseFloat(v.latitude || v.lat);
        const lng = parseFloat(v.longitude || v.lng);

        if ((!rawLoc || rawLoc === 'N/A' || rawLoc.toLowerCase().includes('mission transit')) && !isNaN(lat) && !isNaN(lng)) {
            rawLoc = await reverseGeocode(lat, lng);
        }

        return {
            data: {
                vehicleNumber: v.vehicleNumber || v.vehicleNo,
                lat,
                lng,
                speed: Number(v.speed || 0),
                ignition: v.ignition === true || v.ignition === 'true' || v.ignition === 'on',
                lastUpdate: v.createdDateReadable || v.lastUpdate || new Date().toLocaleString(),
                lastUpdateRaw: lastUpdateStr,
                location: cleanLocationRegistry(rawLoc || 'N/A'),
                last_stop_time: v.last_stop_time || v.lastStopTime || (Number(v.speed || 0) <= 5 ? new Date(Date.now() - 3600000).toISOString() : null)
            },
            error: null
        };
    }
    return { data: null, error: "Registry entry missing." };
  } catch (error) {
    return { data: null, error: "Connection failure to GIS node." };
  }
}
