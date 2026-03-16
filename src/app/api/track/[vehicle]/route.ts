export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Baaki aapka purana code yahan rahega...

import { NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Firebase Admin Setup
// Dhyaan dein: env variable single line mein hona chahiye
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!getApps().length && serviceAccountKey) {
  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error("Firebase Admin Initialization Error:", error);
  }
}

const db = getFirestore();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ vehicle: string }> }
) {
  const { vehicle } = await params;

  try {
    // 1. Settings fetch karein (Gateway Configuration page se saved data)
    const settingsSnap = await db.collection("gps_settings").doc("wheelseye").get();
    
    if (!settingsSnap.exists) {
        return NextResponse.json({ error: "GPS Settings not found in Firestore" }, { status: 404 });
    }

    const settings = settingsSnap.data();
    const { apiUrl, accessToken } = settings || {};

    // 2. Final URL taiyar karein
    // Wheelseye API aksar query param mein token leti hai
    let finalUrl = apiUrl.includes('?') 
        ? `${apiUrl}&accessToken=${accessToken}` 
        : `${apiUrl}?accessToken=${accessToken}`;

    // Agar kisi specific vehicle ka data chahiye (e.g. /api/track/UP16FK4120)
    if (vehicle !== 'all') {
        finalUrl += `&vehicleId=${vehicle}`;
    }

    // 3. Wheelseye API Call (Server-to-Server call bypasses CORS)
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 } // Cache refresh har baar
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Wheelseye Sync Failed: ${errorText}`);
    }

    const data = await response.json();
    
    // API response format handle karein
    const finalData = Array.isArray(data) ? data : (data.data || [data]);
    
    return NextResponse.json(finalData);

  } catch (error: any) {
    console.error("Critical GPS Bridge Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
