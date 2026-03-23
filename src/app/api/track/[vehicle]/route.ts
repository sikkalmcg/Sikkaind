// 1. Next.js ko order dein ki build ke waqt ise touch na kare
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// 2. Database ko "Lazy Load" karne ka function
function getFirebaseDb() {
    if (!getApps().length) {
        const serviceAccountKey = process.env.SERVICE_ACCOUNT_JSON;
        if (!serviceAccountKey) {
            // Build time par variables nahi hote, isliye crash hone se bachayega
            return null;
        }
        try {
            const serviceAccount = JSON.parse(serviceAccountKey);
            initializeApp({ credential: cert(serviceAccount) });
        } catch (e) {
            console.error("JSON Parse Error:", e);
            return null;
        }
    }
    return getFirestore();
}

// 3. Reverse Geocoding ka function
async function getAddressFromCoordinates(lat: number, lon: number) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
            headers: {
                'User-Agent': 'Sikka-App/1.0' // Nominatim requires a User-Agent
            }
        });
        if (!response.ok) {
            // Agar API se error aaye to log karein
            console.error(`Nominatim API failed with status: ${response.status}`);
            return "Unable to fetch address";
        }
        const data = await response.json();
        return data.display_name || "Address not found";
    } catch (error) {
        console.error("Reverse geocoding error:", error);
        return "Error fetching address";
    }
}


export async function GET(
    request: Request,
    { params }: { params: any }
) {
    const db = getFirebaseDb();

    if (!db) {
        return NextResponse.json({ error: "Database connection failed or Building..." }, { status: 500 });
    }

    const resolvedParams = await params;
    const vehicle = resolvedParams.vehicle;

    try {
        const settingsSnap = await db.collection("gps_settings").doc("wheelseye").get();

        if (!settingsSnap.exists) {
            return NextResponse.json({ error: "GPS Settings not found" }, { status: 404 });
        }

        const settings = settingsSnap.data();
        const { apiUrl, accessToken } = settings || {};

        let finalUrl = apiUrl.includes('?')
            ? `${apiUrl}&accessToken=${accessToken}`
            : `${apiUrl}?accessToken=${accessToken}`;

        if (vehicle && vehicle !== 'all') {
            finalUrl += `&vehicleId=${vehicle}`;
        }

        const response = await fetch(finalUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            next: { revalidate: 0 }
        });

        const data = await response.json();
        
        // Yahan se Reverse Geocoding logic shuru hota hai
        if (data && data.data && data.data.length > 0) {
            // Hum sabhi vehicles ke liye address fetch karenge
            for (const vehicleItem of data.data) {
                const { latitude, longitude } = vehicleItem.gpsData || {};
                
                if (latitude && longitude) {
                    // Coordinates se address fetch karein
                    const address = await getAddressFromCoordinates(latitude, longitude);
                    // Vehicle data mein address add karein
                    vehicleItem.address = address;
                } else {
                    vehicleItem.address = "Location data not available";
                }
            }
        }

        return NextResponse.json(data);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}