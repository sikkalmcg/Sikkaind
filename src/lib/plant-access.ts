import { KNOWN_PLANTS, PlantLocation } from './geofence';

/**
 * Normalizes a plant identifier (code or name) for comparison.
 */
export function normalizePlantKey(val?: string | null): string {
  if (!val) return '';
  return String(val).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if a given plant matches any of the user's authorized plants.
 * Handles both codes (e.g. 'TEA', '1426') and names (e.g. 'Tea Plant', 'Salt Plant').
 */
export function isUserAuthorizedForPlant(
  authorizedPlants: string[] | undefined | null,
  targetPlantCodeOrName?: string | null,
  allPlants: PlantLocation[] = KNOWN_PLANTS
): boolean {
  // If no restriction specified or empty, user is either unrestricted (admin) or handled by caller
  if (!authorizedPlants || authorizedPlants.length === 0) return true;
  if (!targetPlantCodeOrName) return false;

  const targetKey = normalizePlantKey(targetPlantCodeOrName);

  // Check direct match in authorized list
  for (const auth of authorizedPlants) {
    const authKey = normalizePlantKey(auth);
    if (authKey === targetKey) return true;

    // Cross-match using known and dynamic plants list
    const plantInfo = allPlants.find(
      p => normalizePlantKey(p.plantCode) === authKey || normalizePlantKey(p.plantName) === authKey
    );
    if (plantInfo) {
      if (normalizePlantKey(plantInfo.plantCode) === targetKey || normalizePlantKey(plantInfo.plantName) === targetKey) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Formats a plant code/name into a user-friendly display name.
 */
export function getFriendlyPlantName(plantCodeOrName?: string | null, allPlants: PlantLocation[] = KNOWN_PLANTS): string {
  if (!plantCodeOrName) return 'Plant';
  const key = normalizePlantKey(plantCodeOrName);
  const found = allPlants.find(p => normalizePlantKey(p.plantCode) === key || normalizePlantKey(p.plantName) === key);
  return found?.plantName || plantCodeOrName;
}
