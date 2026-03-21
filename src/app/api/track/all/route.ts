import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Wheelseye actual API details
        // Token is now stored in environment variables for better security
        const API_KEY = process.env.WHEELSEYE_API_KEY;
        const WHEELSEYE_URL = 'https://api.wheelseye.com/v1/vehicle/list'; 

        if (!API_KEY) {
            throw new Error('Wheelseye API key is not configured');
        }

        const response = await fetch(WHEELSEYE_URL, {
            method: 'GET',
            headers: {
                // The API key is sent in the Authorization header
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            next: { revalidate: 10 } // Data caching/refresh strategy
        });

        if (!response.ok) {
            // This will now provide a more useful error message in the logs, e.g., 401, 403, etc.
            const errorText = await response.text();
            throw new Error(`Wheelseye API responded with status: ${response.status}. Body: ${errorText}`);
        }

        const result = await response.json();

        // Data structure mapping (No changes here)
        const vehicles = (result.data || result.list || []).map((v: any) => ({
            vehicleNumber: v.vehicleNumber || v.regNo || "Unknown",
            speed: v.speed || 0,
            ignition: v.ignition === true || v.ignition === 'on' || v.ignition === 1,
            location: v.location || v.address || "Fetching address...",
            lat: v.lat || v.latitude,
            lng: v.lng || v.longitude
        }));

        return NextResponse.json({ 
            success: true, 
            list: vehicles 
        });

    } catch (error: any) {
        console.error("API Error:", error); // Log the full error object
        return NextResponse.json({ 
            success: false, 
            list: [], 
            error: error.message 
        }, { status: 500 });
    }
}