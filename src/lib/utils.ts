import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { isValid } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizePlantId(plantId: string | number): string {
  if (!plantId) return '';
  return String(plantId).trim();
}

/**
 * Robust Date Parser Node
 * Safely resolves Firestore Timestamps, serialized objects, or raw date strings into valid Date objects.
 */
export function parseSafeDate(date: any): Date | null {
    if (!date) return null;
    try {
        if (date instanceof Date) {
            return isNaN(date.getTime()) ? null : date;
        }
        if (typeof date.toDate === 'function') {
            return date.toDate();
        }
        if (typeof date === 'object' && 'seconds' in date) {
            return new Date(date.seconds * 1000);
        }
        const d = new Date(date);
        return isNaN(d.getTime()) ? null : d;
    } catch (e) {
        return null;
    }
}

/**
 * Sanitizes a registry node for archive storage.
 */
export function sanitizeRegistryNode(data: any): any {
    if (!data) return data;
    const sanitized = { ...data };
    
    const heavyFields = ['fuelSlipImageUrl', 'podUrl', 'logoUrl', 'signatureImageUri'];
    heavyFields.forEach(f => {
        if (sanitized[f] && typeof sanitized[f] === 'string' && sanitized[f].length > 1000) {
            sanitized[f] = '[LOG_STRIPPED_FOR_ARCHIVE]';
        }
    });

    Object.keys(sanitized).forEach(key => {
        if (sanitized[key] === undefined) {
            delete sanitized[key];
        }
    });

    return sanitized;
}
