import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInMinutes, isValid } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizePlantId(plantId: string | number): string {
  if (!plantId) return '';
  return String(plantId).trim();
}

export function formatSequenceId(prefix: string, sequence: number, length: number = 7): string {
  return `${prefix}${String(sequence).padStart(length, '0')}`;
}

/**
 * Generates a unique Trip ID node.
 * Standard: 'T' + 9 Unique Digits.
 */
export function generateRandomTripId(): string {
  const digits = Math.floor(100000000 + Math.random() * 900000000);
  return 'T' + digits;
}

export function incrementSerial(lastSerial: string): string {
    if (!lastSerial) return '0001';
    const num = parseInt(lastSerial, 10);
    if (isNaN(num)) return lastSerial + '_1';
    return String(num + 1).padStart(lastSerial.length, '0');
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
 * Calculates duration between two dates in HH:MM format.
 */
export function calculateDuration(start: any, end: any): string {
    const s = parseSafeDate(start);
    const e = parseSafeDate(end);
    if (!s || !e) return '--:--';
    const diffMs = e.getTime() - s.getTime();
    if (diffMs < 0) return '00:00';
    const diffMins = Math.floor(diffMs / 60000);
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

export enum OperationType {
    GET = 'get',
    LIST = 'list',
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    WRITE = 'write'
}

/**
 * Global Error Handler Node for Firestore
 */
export async function handleFirestoreError(error: any, operation: OperationType, path: string, data?: any) {
    if (error.code === 'permission-denied' || error.message?.includes('permissions')) {
        const { errorEmitter } = await import('@/firebase/error-emitter');
        const { FirestorePermissionError } = await import('@/firebase/errors');
        
        const permissionError = new FirestorePermissionError({
            path,
            operation,
            requestResourceData: data
        });

        errorEmitter.emit('permission-error', permissionError);
    } else {
        throw error;
    }
}
