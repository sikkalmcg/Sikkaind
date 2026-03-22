import { NextRequest, NextResponse } from 'next/server';

// Helper function to format the address into Street -> City format
const formatAddress = (address: any): string => {
  if (typeof address !== 'string' || !address.trim()) {
    return 'Location Syncing...';
  }
  const parts = address.split(',').map(part => part.trim());
  if (parts.length >= 2) {
    const street = parts[0];
    const city = parts[1];
    // Avoid redundant formats like "Ghaziabad -> Ghaziabad"
    if (street && city && !city.includes(street)) {
      return `${street} → ${city}`;
    }
  }
  // Fallback to the most significant part of the address if format is unexpected
  return parts[0] || address;
};

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();

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
        console.error("WheelsEye API Error:", errorBody);
        return NextResponse.json({ message: `Failed to fetch from GPS provider. Status: ${wheelseyeResponse.status}` }, { status: wheelseyeResponse.status });
    }

    const result = await wheelseyeResponse.json();

    let vehicleList: any[] = [];
    if (result && result.success && Array.isArray(result.data)) {
        vehicleList = result.data;
    } else if (Array.isArray(result)) {
        vehicleList = result;
    } else if (result && result.data && Array.isArray(result.data.list)) {
        vehicleList = result.data.list; // Legacy support
    } else {
        console.error("Unexpected data structure from WheelsEye:", result);
        return NextResponse.json({ message: 'Received invalid data structure from GPS provider.' }, { status: 500 });
    }

    const transformedData = vehicleList.map((vehicle: any) => ({
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
        lastUpdate: vehicle.updatedAt ? formatDistanceToNow(new Date(vehicle.updatedAt), { addSuffix: true }) : 'just now',
    }));

    return NextResponse.json(transformedData);

  } catch (error) {
    console.error("Internal Server Error in /api/track:", error);
    return NextResponse.json({ message: 'Failed to process request due to an internal error.' }, { status: 500 });
  }
}
