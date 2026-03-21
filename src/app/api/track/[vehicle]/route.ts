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

export async function GET(
    request: Request, 
    { params }: { params: any }
) {
    const db = getFirebaseDb();
    
    // Agar build time par hai ya variable missing hai
    if (!db) {
        return NextResponse.json({ error: "Database connection failed or Building..." }, { status: 500 });
    }

    const resolvedParams = await params;
    const vehicle = resolvedParams.vehicle;

    try {
        // Aapka Firestore logic yahan se shuru hoga
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
        return NextResponse.json(data);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}