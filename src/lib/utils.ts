import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Normalizes plant identifiers to ensure consistency between legacy mock IDs 
 * and actual database records.
 * Case-insensitive handshake implementation.
 */
export const normalizePlantId = (id: string | undefined | null): string => {
    if (!id) return '';

    const trimmedId = id.trim();
    if (!trimmedId) return '';

    const mapping: Record<string, string> = {
        'planta': '1426',
        'plantb': '1214',
        'plantc': 'Id23'
    };

    const normalized = trimmedId.toLowerCase();
    return mapping[normalized] || trimmedId;
};

/**
 * Checks if a source plant ID matches any candidate plant IDs using normalization.
 * Case-insensitive matching with alias support.
 */
export const matchesPlantReference = (
    sourcePlantId: string | undefined | null,
    ...candidatePlantIds: Array<string | undefined | null>
): boolean => {
    const normalizedSource = normalizePlantId(sourcePlantId).toLowerCase();
    if (!normalizedSource) return false;

    return candidatePlantIds.some(candidate => normalizePlantId(candidate).toLowerCase() === normalizedSource);
};

type CarrierLike = {
    id?: string;
    name?: string;
    plantId?: string | null;
};

export const getPlantScopedCarriers = <T extends CarrierLike>(
    carriers: T[] | undefined | null,
    plantId: string | undefined | null,
    plantAliases: Array<string | undefined | null> = []
): T[] => {
    if (!Array.isArray(carriers) || carriers.length === 0) return [];

    const normalizedPlantId = normalizePlantId(plantId).toLowerCase();
    const normalizedAliases = plantAliases
        .map(alias => normalizePlantId(alias).toLowerCase())
        .filter(Boolean);

    if (!normalizedPlantId && normalizedAliases.length === 0) return [...carriers];

    return carriers.filter(carrier => {
        const normalizedCarrierPlantId = normalizePlantId(carrier.plantId).toLowerCase();
        if (!normalizedCarrierPlantId) return false;

        return normalizedCarrierPlantId === normalizedPlantId || normalizedAliases.includes(normalizedCarrierPlantId);
    });
};

export const resolvePlantCarrier = <T extends CarrierLike>(
    carriers: T[] | undefined | null,
    plantId: string | undefined | null,
    preferredCarrierId?: string | null,
    plantAliases: Array<string | undefined | null> = []
): T | null => {
    if (!Array.isArray(carriers) || carriers.length === 0) return null;

    const plantScopedCarriers = getPlantScopedCarriers(carriers, plantId, plantAliases);
    if (plantScopedCarriers.length === 0) {
        return carriers.find(carrier => carrier.id === preferredCarrierId) || null;
    }

    if (preferredCarrierId) {
        const exactPlantMatch = plantScopedCarriers.find(carrier => carrier.id === preferredCarrierId);
        if (exactPlantMatch) return exactPlantMatch;

        const preferredCarrier = carriers.find(carrier => carrier.id === preferredCarrierId);
        const preferredName = preferredCarrier?.name?.trim().toLowerCase();
        if (preferredName) {
            const sameNamePlantCarrier = plantScopedCarriers.find(carrier => carrier.name?.trim().toLowerCase() === preferredName);
            if (sameNamePlantCarrier) return sameNamePlantCarrier;
        }
    }

    return plantScopedCarriers[0] || null;
};

/**
 * Generates a zero-padded ID with a prefix.
 * Used for S-series (Orders).
 */
export const formatSequenceId = (prefix: string, count: number): string => {
    if (prefix === 'SIL') return `${prefix}${String(count).padStart(4, '0')}`;
    return `${prefix}${String(count).padStart(9, '0')}`;
};

/**
 * Registry Logic: Generates a non-sequential, unique 10-digit numeric mix Trip ID.
 * Ensuring mission identifiers are randomized and not serial-wise for security.
 * Example Output: T8492038475
 */
export const generateRandomTripId = (): string => {
    const digits = '0123456789';
    let result = 'T';
    for (let i = 0; i < 10; i++) {
        result += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return result;
};

/**
 * Registry Logic: Increments a numeric suffix in a string while preserving prefix.
 * Intelligent extraction for alphanumeric serials.
 * Example: DC25260004 -> DC25260005
 */
export const incrementSerial = (lastSerial: string): string => {
    if (!lastSerial) return "0001";

    const match = lastSerial.match(/^(.*?)(\d+)$/);
    if (!match) return lastSerial + "1";

    const prefix = match[1];
    const numericPart = match[2];
    const nextNumber = parseInt(numericPart, 10) + 1;
    const paddedNumber = String(nextNumber).padStart(numericPart.length, '0');

    return `${prefix}${paddedNumber}`;
};

/**
 * Registry Logic: Sanitizes an object for Firestore by removing 'undefined' values.
 * Prevents "Unsupported field value: undefined" errors during addDoc/setDoc pulses.
 */
export const sanitizeRegistryNode = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(sanitizeRegistryNode);
    if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
        // Firestore internal types (like FieldValue) shouldn't be iterated
        if (obj.constructor?.name === 'FieldValue' || obj._methodName?.includes('FieldValue')) {
            return obj;
        }

        return Object.fromEntries(
            Object.entries(obj)
                .filter(([_, v]) => v !== undefined)
                .map(([k, v]) => [k, sanitizeRegistryNode(v)])
        );
    }
    return obj;
};
