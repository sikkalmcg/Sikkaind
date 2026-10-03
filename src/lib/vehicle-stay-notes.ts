import { format } from 'date-fns';
import { setDocumentNonBlocking } from '@/mongodb';
import { doc } from '@/lib/mongo-store';

export const SHARED_HUB_ID = 'Sikkaind';
export const MAX_NOTE_WORDS = 20;

export interface VehicleNoteRecord {
  id: string;
  vehicleNo: string;
  userName: string;
  note: string;
  createdAt: string; // ISO string
  dateTimeReadable: string; // e.g. "29-Sep-2026 11:30 AM"
  timestamp: number;
}

export interface VehicleGeofenceEvent {
  id: string; // normalized vehicleNo
  vehicleNo: string;
  status: 'INSIDE' | 'OUTSIDE';
  plantCode?: string | null;
  plantName?: string | null;
  inDateTime?: string | null; // ISO string
  inDateTimeReadable?: string | null; // e.g. "02-Oct-2026 09:30 AM"
  outPlantCode?: string | null;
  outPlantName?: string | null; // e.g. "Tea Plant"
  outDateTime?: string | null; // ISO string
  outDateTimeReadable?: string | null; // e.g. "02-Oct-2026 12:10 PM"
  distanceMeters?: number | null;
  lastUpdated: string;
}

export const INITIAL_SAMPLE_NOTES: VehicleNoteRecord[] = [
  {
    id: 'note_init_1',
    vehicleNo: 'UP14GT0300',
    userName: 'Ajay Somra',
    note: 'This vehicle will be load today.',
    createdAt: new Date('2026-09-29T11:30:00+05:30').toISOString(),
    dateTimeReadable: '29-Sep-2026 11:30 AM',
    timestamp: new Date('2026-09-29T11:30:00+05:30').getTime(),
  },
  {
    id: 'note_init_2',
    vehicleNo: 'UP14GT0300',
    userName: 'Satish',
    note: 'Vehicle breakdown.',
    createdAt: new Date('2026-09-29T11:50:00+05:30').toISOString(),
    dateTimeReadable: '29-Sep-2026 11:50 AM',
    timestamp: new Date('2026-09-29T11:50:00+05:30').getTime(),
  },
  {
    id: 'note_init_3',
    vehicleNo: 'UP14GT0300',
    userName: 'Ajay Somra',
    note: 'Will be load tomorrow.',
    createdAt: new Date('2026-09-29T11:55:00+05:30').toISOString(),
    dateTimeReadable: '29-Sep-2026 11:55 AM',
    timestamp: new Date('2026-09-29T11:55:00+05:30').getTime(),
  },
];

/**
 * Format date to standard string: "02-Oct-2026 09:30 AM"
 */
export function formatVehicleDateTime(dateInput: Date | string | number = new Date()): string {
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return format(new Date(), 'dd-MMM-yyyy hh:mm a');
    return format(d, 'dd-MMM-yyyy hh:mm a');
  } catch {
    return format(new Date(), 'dd-MMM-yyyy hh:mm a');
  }
}

/**
 * Calculate vehicle's current stay duration in real time.
 * Formula: Stay Hour = Current Date & Time - Vehicle In Date Time
 * Example:
 * Vehicle IN: 02-Oct-2026 09:30 AM
 * Current time: 02-Oct-2026 11:45 AM
 * Stay Hour: 02:15
 * Output: HH:MM
 */
export function calculateStayHour(inDateTimeStr?: string | null, referenceNow: Date = new Date()): string {
  if (!inDateTimeStr) return '00:00';
  let inTimeMs = NaN;
  const directDate = new Date(inDateTimeStr);
  if (!isNaN(directDate.getTime())) {
    inTimeMs = directDate.getTime();
  } else {
    const parsed = Date.parse(inDateTimeStr);
    if (!isNaN(parsed)) inTimeMs = parsed;
  }

  if (isNaN(inTimeMs)) return '00:00';

  const diffMs = Math.max(0, referenceNow.getTime() - inTimeMs);
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Counts words in a string accurately (splits on whitespace)
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

const STORAGE_KEY_EVENTS = 'sikka_vehicle_geofence_events';
const STORAGE_KEY_NOTES = 'sikka_vehicle_notes';

/**
 * Retrieve cached geofence events from localStorage
 */
export function getLocalGeofenceEvents(): Record<string, VehicleGeofenceEvent> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Persist geofence event locally and to MongoDB
 */
export function persistGeofenceEvent(event: VehicleGeofenceEvent, db?: any) {
  if (typeof window !== 'undefined') {
    try {
      const existing = getLocalGeofenceEvents();
      existing[event.id] = event;
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(existing));
    } catch (e) {
      console.warn('Failed to save geofence event locally:', e);
    }
  }

  if (db && event.id) {
    try {
      const eventRef = doc(db, 'users', SHARED_HUB_ID, 'vehicle_geofence_events', event.id);
      setDocumentNonBlocking(eventRef, event, { merge: true });
    } catch (e) {
      console.warn('Failed to save geofence event to MongoDB:', e);
    }
  }
}

/**
 * Retrieve cached notes from localStorage
 */
export function getLocalNotes(): VehicleNoteRecord[] {
  if (typeof window === 'undefined') return [...INITIAL_SAMPLE_NOTES];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(INITIAL_SAMPLE_NOTES));
      return [...INITIAL_SAMPLE_NOTES];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...INITIAL_SAMPLE_NOTES];
  } catch {
    return [...INITIAL_SAMPLE_NOTES];
  }
}

/**
 * Persist a new note locally and to MongoDB
 */
export function persistNewNote(note: VehicleNoteRecord, db?: any) {
  if (typeof window !== 'undefined') {
    try {
      const existing = getLocalNotes();
      const updated = [...existing, note];
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save note locally:', e);
    }
  }

  if (db && note.id) {
    try {
      const noteRef = doc(db, 'users', SHARED_HUB_ID, 'vehicle_notes', note.id);
      setDocumentNonBlocking(noteRef, note, { merge: true });
    } catch (e) {
      console.warn('Failed to save note to MongoDB:', e);
    }
  }
}

/**
 * Geofence Transition Manager:
 * Evaluates whether vehicle moved inside/outside 500m plant geofence.
 * Prevents duplicate IN/OUT events while vehicle remains inside or outside.
 */
export function processGeofenceTransition({
  vehicleNo,
  isInside,
  plantCode,
  plantName,
  distanceMeters,
  previousEvent,
  now = new Date(),
}: {
  vehicleNo: string;
  isInside: boolean;
  plantCode?: string | null;
  plantName?: string | null;
  distanceMeters?: number | null;
  previousEvent?: VehicleGeofenceEvent;
  now?: Date;
}): { event: VehicleGeofenceEvent; hasChanged: boolean } {
  const norm = vehicleNo.replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
  const nowIso = now.toISOString();
  const nowReadable = formatVehicleDateTime(now);

  if (isInside) {
    // Vehicle is INSIDE plant radius (<= 500m)
    if (previousEvent && previousEvent.status === 'INSIDE') {
      // Already inside: PREVENT DUPLICATE IN EVENT!
      // Keep existing inDateTime & inDateTimeReadable!
      return {
        hasChanged: false,
        event: {
          ...previousEvent,
          distanceMeters: distanceMeters ?? previousEvent.distanceMeters,
          lastUpdated: nowIso,
        },
      };
    }

    // New IN event: Vehicle just entered 500m radius
    const newInEvent: VehicleGeofenceEvent = {
      id: norm,
      vehicleNo,
      status: 'INSIDE',
      plantCode: plantCode || null,
      plantName: plantName || 'Plant',
      inDateTime: nowIso,
      inDateTimeReadable: nowReadable,
      // Clear out fields when re-entering
      outPlantCode: null,
      outPlantName: null,
      outDateTime: null,
      outDateTimeReadable: null,
      distanceMeters: distanceMeters ?? null,
      lastUpdated: nowIso,
    };

    return { event: newInEvent, hasChanged: true };
  } else {
    // Vehicle is OUTSIDE all plant radii (> 500m)
    if (previousEvent && previousEvent.status === 'OUTSIDE') {
      // Already outside: PREVENT DUPLICATE OUT EVENT!
      // Keep existing outPlant & outDateTime intact!
      return {
        hasChanged: false,
        event: {
          ...previousEvent,
          distanceMeters: distanceMeters ?? previousEvent.distanceMeters,
          lastUpdated: nowIso,
        },
      };
    }

    // New OUT event: Vehicle just left 500m radius!
    const exitedPlantName = previousEvent?.plantName || 'Plant';
    const exitedPlantCode = previousEvent?.plantCode || null;

    const newOutEvent: VehicleGeofenceEvent = {
      id: norm,
      vehicleNo,
      status: 'OUTSIDE',
      plantCode: null,
      plantName: null,
      inDateTime: null,
      inDateTimeReadable: null,
      outPlantCode: exitedPlantCode,
      outPlantName: exitedPlantName,
      outDateTime: nowIso,
      outDateTimeReadable: nowReadable,
      distanceMeters: distanceMeters ?? null,
      lastUpdated: nowIso,
    };

    return { event: newOutEvent, hasChanged: true };
  }
}
