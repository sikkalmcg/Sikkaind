import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_GEOCODING_API_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";

const formatAddress = (address: any): string => {
  if (typeof address !== 'string' || !address.trim()) {
    return 'Address not available';
  }
  const parts = address.split(',').map((part: string) => part.trim());
  if (parts.length >= 2) {
    const street = parts[0];
    const city = parts[1];
    if (street && city && !city.includes(street)) {
      return `${street} → ${city}`;
    }
  }
  return parts[0] || address;
};

const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_GEOCODING_API_KEY}&result_type=locality|sublocality|route|political`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const best = data.results[0];
      const components: any[] = best.address_components || [];
      const locality = components.find((c: any) => c.types.includes('locality'))?.long_name;
      const subloc = components.find((c: any) => c.types.includes('sublocality_level_1'))?.long_name;
      const state = components.find((c: any) => c.types.includes('administrative_area_level_1'))?.long_name;
      const route = components.find((c: any) => c.types.includes('route'))?.long_name;

      if (route && locality) return `${route} → ${locality}`;
      if (subloc && locality) return `${subloc} → ${locality}`;
      if (locality && state) return `${locality}, ${state}`;
      return best.formatted_address.split(',').slice(0, 2).join(',');
    }
  } catch (e) {
    console.error('Reverse geocode failed:', e);
  }
  return 'Location Unavailable';
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = await req.text();

    if (!apiKey) {
      return NextResponse.json({ message: 'API key is required.' }, { status: 400 });
    }

    const url = `https://api.wheelseye.com/currentLoc?accessToken=${apiKey}`;

    const wheelseyeResponse = await fetch(url, {
        method: 'GET',
        headers: { 'accept': 'application/json' },
        cache: 'no-store',
    });

    if (!wheelseyeResponse.ok) {
        const errorBody = await wheelseyeResponse.text();
        console.warn(`WheelsEye API Gateway Warning [${wheelseyeResponse.status}]:`, errorBody.slice(0, 100));
        
        if (wheelseyeResponse.status === 503 || wheelseyeResponse.status === 504) {
             return NextResponse.json({ 
                 message: 'Wheelseye Tracking Gateway is temporarily unavailable (Maintenance). Please try again later.',
                 success: false,
                 list: []
             }, { status: 200 });
        }

        return NextResponse.json({ message: `Failed to fetch from GPS provider. Status: ${wheelseyeResponse.status}` }, { status: wheelseyeResponse.status });
    }

    const result = await wheelseyeResponse.json();

    let vehicleList: any[] = [];
    if (result && result.success && Array.isArray(result.data)) {
        vehicleList = result.data;
    } else if (Array.isArray(result)) {
        vehicleList = result;
    } else if (result && result.data && Array.isArray(result.data.list)) {
        vehicleList = result.data.list;
    } else {
        console.error("Unexpected data structure from WheelsEye:", result);
        return NextResponse.json({ message: 'Received invalid data structure from GPS provider.' }, { status: 500 });
    }

    const partialData = vehicleList.map((vehicle: any) => ({
        id: vehicle.deviceNumber || vehicle.vehicleNumber,
        vehicleNumber: vehicle.vehicleNumber,
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
        speed: vehicle.speed || 0,
        ignition: vehicle.ignition || false,
        angle: vehicle.angle || 0,
        location: formatAddress(vehicle.address),
        driverName: vehicle.vendorName || vehicle.driverName || 'N/A',
        driverMobile: vehicle.driverMobile || 'N/A',
        lastUpdateRaw: vehicle.updatedAt || new Date().toISOString(),
    }));

    const enriched = await Promise.all(
      partialData.map(async (v) => {
        if (v.location === 'Address not available' && v.latitude && v.longitude) {
          const resolvedAddress = await reverseGeocode(v.latitude, v.longitude);
          return { ...v, location: resolvedAddress };
        }
        return { ...v, location: v.location || 'Location Unavailable' };
      })
    );

    return NextResponse.json(enriched);

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error("Internal Server Error in /api/track:", error);
    return NextResponse.json({ message: `Failed to process request: ${errorMessage}` }, { status: 500 });
  }
}
