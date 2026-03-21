import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ message: 'API key is required.' }, { status: 400 });
    }

    // Use the new endpoint provided by the user with accessToken
    const url = `https://api.wheelseye.com/currentLoc?accessToken=${apiKey}`;

    const wheelseyeResponse = await fetch(url, {
        method: 'GET', // Changed to GET as per the new endpoint structure
        headers: {
            'accept': 'application/json',
        },
        cache: 'no-store',
    });

    if (!wheelseyeResponse.ok) {
        if (wheelseyeResponse.status === 503) {
            return NextResponse.json({ message: "The GPS provider\'s service is temporarily unavailable (Error 503). Please try again later." }, { status: 503 });
        }
        const errorBody = await wheelseyeResponse.text();
        console.error("WheelsEye API Error:", errorBody);
        return NextResponse.json({ message: `Failed to fetch from GPS provider. Details: ${errorBody}` }, { status: wheelseyeResponse.status });
    }

    const result = await wheelseyeResponse.json();

    // Flexibly find the vehicle list in the response
    let vehicleList: any[] = [];
    if (result && result.success && Array.isArray(result.data)) {
        vehicleList = result.data; // Handles { success: true, data: [...] }
    } else if (Array.isArray(result)) {
        vehicleList = result; // Handles [...] directly
    } else if (result && result.data && Array.isArray(result.data.list)) {
        vehicleList = result.data.list; // Handles the old structure { data: { list: [...] } }
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
        location: vehicle.address || 'Location Syncing...',
        driverName: vehicle.venndorName || vehicle.driverName || 'N/A',
        driverMobile: vehicle.driverMobile || 'N/A',
    }));

    return NextResponse.json(transformedData);

  } catch (error) {
    console.error("Internal Server Error in /api/track:", error);
    return NextResponse.json({ message: 'Failed to process request due to an internal error.' }, { status: 500 });
  }
}
