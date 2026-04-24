'use server';

import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/firebase/init";

/**
 * @fileOverview Hardened GIS Utility for Wheelseye Handshake (Server Node).
 * MARKED AS SERVER ACTION to prevent CORS violations and protect registry keys.
 */

const GOOGLE_MAPS_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";
const AUTHORIZED_TOKEN = "53afc208-0981-48c7-b134-d85d2f33dc0c";

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
    if (!address || address === 'N/A' || address === 'Address not available' || address.toLowerCase().includes('establishing')) return 'Location Registry Sync...';
    return address.trim();
}

async function getSettings() {
    try {
        const settingsRef = doc(firestore, "gps_settings", "api_config");
        const snap = await getDoc(settingsRef);
        if (snap.exists()) {
            const data = snap.data();
            return {
                apiUrl: "https://api.wheelseye.com/currentLoc",
                accessToken: data.apiKey || AUTHORIZED_TOKEN
            };
        }
    } catch (e) {
        console.warn("Using authorized default GIS node.");
    }
    return {
        apiUrl: "https://api.wheelseye.com/currentLoc",
        accessToken: AUTHORIZED_TOKEN
    };
}

export async function fetchFleetLocation() {
  const settings = await getSettings();
  const url = `${settings.apiUrl}?accessToken=${settings.accessToken}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
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

        if ((!rawLoc || rawLoc === 'N/A' || rawLoc === 'Address not available') && !isNaN(lat) && !isNaN(lng)) {
            rawLoc = await reverseGeocode(lat, lng);
        }

        return {
            vehicleNumber: v.vehicleNumber?.toUpperCase().replace(/\s/g, '') || v.vehicleNo,
            deviceNumber: v.deviceNumber || v.imei || '',
            lat,
            lng,
            latitude: lat,
            longitude: lng,
            speed: Number(v.speed || 0),
            ignition: v.ignition === true || v.ignition === 'true' || v.ignition === 'on',
            angle: Number(v.angle || 0),
            lastUpdate: v.createdDateReadable || v.lastUpdate || new Date().toLocaleString(),
            lastUpdateRaw: lastUpdateStr,
            provider: v.provider || 'Wheelseye',
            location: cleanLocationRegistry(rawLoc || 'N/A'),
            last_stop_time: v.last_stop_time || v.lastStopTime || null
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
  
  const url = `${settings.apiUrl}?accessToken=${settings.accessToken}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) return { data: null, error: "Gateway Unreachable" };

    const result = await response.json();
    const list = result?.data?.list || result?.data || [];
    
    if (Array.isArray(list)) {
        const v = list.find((item: any) => {
            const vNo = (item.vehicleNumber || item.vehicleNo || item.regNo)?.toUpperCase().replace(/\s/g, '');
            return vNo === cleanNo;
        });

        if (!v) return { data: null, error: "Vehicle not found in live stream." };

        let rawLoc = v.address || v.location || v.currentLocation || v.last_location || v.current_location || v.lastUpdateAddress || v.formattedAddress;
        const lastUpdateStr = v.createdDate || v.lastUpdate || v.last_updated_time || new Date().toISOString();

        const lat = parseFloat(v.latitude || v.lat);
        const lng = parseFloat(v.longitude || v.lng);

        if ((!rawLoc || rawLoc === 'N/A' || rawLoc === 'Address not available') && !isNaN(lat) && !isNaN(lng)) {
            rawLoc = await reverseGeocode(lat, lng);
        }

        return {
            data: {
                vehicleNumber: v.vehicleNumber || v.vehicleNo,
                lat,
                lng,
                latitude: lat,
                longitude: lng,
                speed: Number(v.speed || 0),
                ignition: v.ignition === true || v.ignition === 'true' || v.ignition === 'on',
                lastUpdate: v.createdDateReadable || v.lastUpdate || new Date().toLocaleString(),
                lastUpdateRaw: lastUpdateStr,
                location: cleanLocationRegistry(rawLoc || 'N/A'),
                last_stop_time: v.last_stop_time || v.lastStopTime || null
            },
            error: null
        };
    }
    return { data: null, error: "Registry entry missing." };
  } catch (error) {
    return { data: null, error: "Connection failure to GIS node." };
  }
}