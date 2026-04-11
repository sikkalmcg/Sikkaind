import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Wheelseye actual API details
        // Token is now stored in environment variables for better security
        const API_KEY = process.env.NEXT_PUBLIC_WHEELSEYE_API_KEY || "53afc208-0981-48c7-b134-d85d2f33dc0c";
        const WHEELSEYE_URL = `https://api.wheelseye.com/currentLoc?accessToken=${API_KEY}`;

        if (!API_KEY) {
            throw new Error('Wheelseye API key is not configured');
        }

        const response = await fetch(WHEELSEYE_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            next: { revalidate: 10 } // Data caching/refresh strategy
        });

        if (!response.ok) {
            // Handle 503 and other non-OK responses gracefully
            const errorText = await response.text();
            console.warn(`Wheelseye API Gateway Warning [${response.status}]:`, errorText.slice(0, 100));

            // If it's a 503 or 504, it's likely temporary downtime
            if (response.status === 503 || response.status === 504) {
                return NextResponse.json({ 
                    success: false, 
                    list: [], 
                    error: "Wheelseye Tracking Gateway is temporarily unavailable (Maintenance). Please try again later."
                });
            }

            throw new Error(`Wheelseye API responded with status: ${response.status}.`);
        }

        const result = await response.json();

        const vehicleData = result.data || result.list;

        // Data structure mapping
        const vehicles = Array.isArray(vehicleData) ? vehicleData.map((v: any) => ({
            vehicleNumber: v.vehicleNumber || v.regNo || "Unknown",
            speed: v.speed || 0,
            ignition: v.ignition === true || v.ignition === 'on' || v.ignition === 1,
            location: v.location || v.address || "Fetching address...",
            lat: v.lat || v.latitude,
            lng: v.lng || v.longitude
        })) : [];

        return NextResponse.json({ 
            success: true, 
            list: vehicles 
        });

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ 
            success: false, 
            list: [], 
            error: error.message 
        }, { status: 500 });
    }
}
