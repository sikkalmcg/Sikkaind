export function getMapTilerToken(): string {
  const token = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || process.env.MAPTILER_API_KEY;
  if (!token) {
    // No throw here to keep UI working even without directions; map tiles may still fail.
    console.warn('MapTiler API token missing. Set NEXT_PUBLIC_MAPTILER_API_KEY or MAPTILER_API_KEY');
  }
  return token || '';
}

export function buildMapTilerStyleUrl(token: string): string {
  // Vector tiles style served by MapTiler
  // https://docs.maptiler.com/get-started/maptiler-maps/<how-to-use>
  if (!token) return '';
  return `https://api.maptiler.com/maps/streets/style.json?key=${encodeURIComponent(token)}`;
}

export function buildMapTilerGeocodeUrl(query: string, token: string): string {
  // MapTiler Geocoding API (forward geocoding)
  // Docs: https://docs.maptiler.com/maps-api/geocoding/
  return `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${encodeURIComponent(token)}`;
}

export function buildMapTilerDirectionsUrl(params: {
  startLon: number;
  startLat: number;
  endLon: number;
  endLat: number;
  token: string;
}): string {
  // MapTiler Directions API
  // Docs: https://docs.maptiler.com/roads-and-traffic/directions/
  // Note: the exact endpoint may vary by product; this uses a common pattern.
  const {
    startLon,
    startLat,
    endLon,
    endLat,
    token,
  } = params;

  // Using OSRM-like query parameters where possible.
  // If your product differs, adjust this URL.
  return `https://api.maptiler.com/route?key=${encodeURIComponent(token)}&origin=${startLon},${startLat}&destination=${endLon},${endLat}`;
}

