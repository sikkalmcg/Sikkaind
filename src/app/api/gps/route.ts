import { NextResponse } from 'next/server';

/**
 * @fileOverview WheelEye GPS Proxy API Route.
 * Proxies requests to WheelEye current-location API securely on the backend.
 * Never exposes the accessToken in frontend/browser code.
 */
export async function GET(request: Request) {
  // Use securely stored backend environment token
  const token = process.env.WHEELSEYE_ACCESS_TOKEN || '53afc208-0981-48c7-b134-d85d2f33dc0c';
  const apiUrl = `https://api.wheelseye.com/currentLoc?accessToken=${encodeURIComponent(token)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
      next: { revalidate: 0 } // No caching of live GPS
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false, 
          error: `WheelEye API responded with status ${response.status}`,
          data: { list: [] },
          fetchedAt: new Date().toISOString()
        }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      ...data,
      fetchedAt: new Date().toISOString()
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("WheelEye GPS Proxy Error:", error);
    const isTimeout = error.name === 'AbortError';
    return NextResponse.json(
      { 
        success: false, 
        error: isTimeout ? 'WheelEye API request timed out (12s threshold)' : (error.message || 'WheelEye gateway unreachable'),
        data: { list: [] },
        fetchedAt: new Date().toISOString()
      }, 
      { status: isTimeout ? 504 : 500 }
    );
  }
}
