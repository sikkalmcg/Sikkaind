import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

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

export function generateRandomTripId(): string {
  return 'T' + Math.random().toString(36).substring(2, 11).toUpperCase();
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
        // Case 1: Standard Date object
        if (date instanceof Date) {
            return isNaN(date.getTime()) ? null : date;
        }
        // Case 2: Firestore Timestamp instance
        if (typeof date.toDate === 'function') {
            return date.toDate();
        }
        // Case 3: Serialized Firestore Timestamp (object with seconds/nanoseconds)
        if (typeof date === 'object' && 'seconds' in date) {
            return new Date(date.seconds * 1000);
        }
        // Case 4: String or other format
        const d = new Date(date);
        return isNaN(d.getTime()) ? null : d;
    } catch (e) {
        return null;
    }
}

/**
 * Sanitizes a registry node for archive storage.
 * Removes heavy binary data or non-essential recursive links.
 * PURGES undefined fields to prevent Firestore Transaction errors.
 */
export function sanitizeRegistryNode(data: any): any {
    if (!data) return data;
    const sanitized = { ...data };
    
    // Remove heavy binary fields if they exist in the snapshot
    const heavyFields = ['fuelSlipImageUrl', 'podUrl', 'logoUrl', 'signatureImageUri'];
    heavyFields.forEach(f => {
        if (sanitized[f] && typeof sanitized[f] === 'string' && sanitized[f].length > 1000) {
            sanitized[f] = '[LOG_STRIPPED_FOR_ARCHIVE]';
        }
    });

    // MISSION CRITICAL: Purge undefined fields to prevent Firestore Transaction errors
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
 * Standardizes the surfacing of permission errors to the agentic loop.
 */
export async function handleFirestoreError(error: any, operation: OperationType, path: string, data?: any) {
    // Only process standard Firebase permission errors
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
