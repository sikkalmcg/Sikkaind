// 1. Next.js ko order dein ki build ke waqt ise touch na kare
export const dynamic = 'force-dynamic'; 
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { adminDb as db } from "@/firebase/admin";

export async function GET(
    request: Request, 
    { params }: { params: { vehicle: string } }
) {
    if (!db) {
        return NextResponse.json({ error: "Database connection failed or Building..." }, { status: 500 });
    }
    const { vehicle } = params;

    try {
        // Aapka Firestore logic yahan se shuru hoga
        const settingsSnap = await db.collection("gps_settings").doc("wheelseye").get();
        
        if (!settingsSnap.exists) {
            return NextResponse.json({ error: "GPS Settings not found" }, { status: 404 });
        }

        const settings = settingsSnap.data();
        const { apiUrl, accessToken } = settings || {};

        if (!apiUrl || !accessToken) {
            return NextResponse.json({ error: "API URL or Access Token missing in settings" }, { status: 500 });
        }

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
        return NextResponse.json(data);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}