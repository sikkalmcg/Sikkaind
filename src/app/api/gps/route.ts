
import { NextResponse } from 'next/server';

/**
 * @fileOverview GPS Proxy API Route.
 * Proxies requests to the Wheelseye API to bypass client-side CORS restrictions.
 */
export async function GET() {
  const apiUrl = 'https://api.wheelseye.com/currentLoc?accessToken=53afc208-0981-48c7-b134-d85d2f33dc0c';
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Ensure we don't cache stale vehicle locations
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Wheelseye API synchronization failure: ${response.status}` }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Internal GPS Proxy Error:", error);
    return NextResponse.json(
      { error: error.message || 'Internal System Error during API handshake' }, 
      { status: 500 }
    );
  }
}
