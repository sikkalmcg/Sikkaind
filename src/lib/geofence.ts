/**
 * @fileOverview Shared Geofence & Proximity Detection Utilities.
 * Evaluates vehicle GPS positions against active plant geofences (200m threshold).
 */

export interface PlantLocation {
  id?: string;
  plantCode?: string;
  plantName: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}

// Active Sikka Fleet Plants Coordinates
export const KNOWN_PLANTS: PlantLocation[] = [
  {
    plantCode: '1426',
    plantName: 'Salt Plant',
    latitude: 28.637612474908515,
    longitude: 77.44251105844168,
    radiusMeters: 200,
  },
  {
    plantCode: 'TEA',
    plantName: 'Tea Plant',
    latitude: 28.65469625753996,
    longitude: 77.46339802500502,
    radiusMeters: 200,
  },
  {
    plantCode: 'DASNA',
    plantName: 'Dasna Plant',
    latitude: 28.685417861408954,
    longitude: 77.52932879556363,
    radiusMeters: 200,
  },
];

/**
 * Calculates geodesic distance between two points in meters using the Haversine formula
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export interface GeofenceEvaluation {
  isInside: boolean;
  plantCode: string | null;
  plantName: string | null;
  distanceMeters: number | null;
  displayText: string;
  widgetId: 'salt-plant' | 'tea-plant' | 'dasna-plant' | 'outside';
}

/**
 * Evaluates whether vehicle coordinates are within 200 meters of ANY active plant
 */
export function evaluateGeofenceStatus(
  latitude?: number, 
  longitude?: number, 
  plantsList: PlantLocation[] = KNOWN_PLANTS
): GeofenceEvaluation {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
    return {
      isInside: false,
      plantCode: null,
      plantName: null,
      distanceMeters: null,
      displayText: 'Outside Plant',
      widgetId: 'outside',
    };
  }

  let minDistance = Infinity;
  let nearestPlant: PlantLocation | null = null;

  for (const plant of plantsList) {
    if (typeof plant.latitude === 'number' && typeof plant.longitude === 'number') {
      const dist = calculateDistanceMeters(latitude, longitude, plant.latitude, plant.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearestPlant = plant;
      }
    }
  }

  // 200-meter proximity threshold
  if (nearestPlant && minDistance <= 200) {
    const pCode = (nearestPlant.plantCode || '').toUpperCase();
    const pName = (nearestPlant.plantName || '').toLowerCase();

    let widgetId: GeofenceEvaluation['widgetId'] = 'outside';
    if (pCode === '1426' || pCode.includes('SALT') || pName.includes('salt')) {
      widgetId = 'salt-plant';
    } else if (pCode === 'TEA' || pName.includes('tea')) {
      widgetId = 'tea-plant';
    } else if (pCode === 'DASNA' || pName.includes('dasna')) {
      widgetId = 'dasna-plant';
    }

    return {
      isInside: true,
      plantCode: nearestPlant.plantCode || null,
      plantName: nearestPlant.plantName,
      distanceMeters: minDistance,
      displayText: `Inside Plant: ${nearestPlant.plantName}`,
      widgetId,
    };
  }

  return {
    isInside: false,
    plantCode: null,
    plantName: null,
    distanceMeters: minDistance !== Infinity ? minDistance : null,
    displayText: 'Outside Plant',
    widgetId: 'outside',
  };
}
