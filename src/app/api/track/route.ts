import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ message: 'API key is required.' }, { status: 400 });
    }

    const wheelseyeResponse = await fetch('https://api.wheelseye.com/gps/api/vehicle/listAll', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
        },
        body: JSON.stringify({
            apiKey: apiKey,
            pageNo: 0,
            pageSize: 100
        }),
        cache: 'no-store',
    });

    if (!wheelseyeResponse.ok) {
        // Handle specific server errors with user-friendly messages
        if (wheelseyeResponse.status === 503) {
            return NextResponse.json({ message: "The GPS provider\'s service is temporarily unavailable (Error 503). Please try again later." }, { status: 503 });
        }

        const errorBody = await wheelseyeResponse.text();
        console.error("WheelsEye API Error:", errorBody);
        return NextResponse.json({ message: `Failed to fetch from GPS provider. Details: ${errorBody}` }, { status: wheelseyeResponse.status });
    }

    const result = await wheelseyeResponse.json();

    if (result && result.success && result.data && Array.isArray(result.data.list)) {
        const transformedData = result.data.list.map((vehicle: any) => ({
            id: vehicle.deviceNumber || vehicle.vehicleNumber,
            vehicleNumber: vehicle.vehicleNumber,
            latitude: vehicle.latitude,
            longitude: vehicle.longitude,
            speed: vehicle.speed || 0,
            ignition: vehicle.ignition || false,
            angle: vehicle.angle || 0,
            location: vehicle.address || 'Location Syncing...',
            driverName: vehicle.venndorName,
            driverMobile: 'N/A',
        }));
        return NextResponse.json(transformedData);
    } else {
        console.error("Unexpected data structure from WheelsEye:", result);
        return NextResponse.json({ message: 'Received invalid data structure from GPS provider.' }, { status: 500 });
    }

  } catch (error) {
    console.error("Internal Server Error in /api/track:", error);
    return NextResponse.json({ message: 'Failed to process request due to an internal error.' }, { status: 500 });
  }
}
