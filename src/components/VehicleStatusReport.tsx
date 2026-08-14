import React from 'react';

// --- Type Definitions ---

interface StatusRecord {
  status: string;
  fromDateTime: Date;
  toDateTime: Date | null;
  remarks: string;
}

/**
 * Represents a single, complete vehicle visit/session.
 * This structure is essential for VT03 reporting.
 */
interface VehicleSession {
  sessionId: string;
  plant: string; // "Outside" for non-plant vehicles
  vehicleNumber: string;
  driverName: string;
  station: string;
  inDateTime: Date;
  outDateTime: Date | null;
  statusHistory: StatusRecord[];
}

// --- Helper Functions for Calculations ---

/**
 * Calculates the difference between two dates in HH:MM format.
 */
const formatDuration = (start: Date, end: Date | null): string => {
  if (!end) return 'N/A';
  let diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) diffMs = 0;

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Calculates total stay hours for specific status categories.
 * @param history The status history for a session.
 * @param categories An array of status strings (case-insensitive) to sum up.
 */
const calculateCategorizedStayHours = (history: StatusRecord[], categories: string[]): string => {
  let totalMs = 0;
  const lowerCaseCategories = categories.map(c => c.toLowerCase());

  history.forEach(record => {
    if (record.toDateTime && lowerCaseCategories.includes(record.status.toLowerCase())) {
      totalMs += record.toDateTime.getTime() - record.fromDateTime.getTime();
    }
  });

  if (totalMs <= 0) return '00:00';

  const hours = Math.floor(totalMs / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatDate = (date: Date | null) => {
    if (!date) return '—';
    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/,/, '');
}

// --- Mock Data ---
// In a real app, this data would be fetched from your database.
const mockVehicleSessions: VehicleSession[] = [
  {
    sessionId: 'SESS001',
    plant: 'PLANT-A',
    vehicleNumber: 'UP14AB1234',
    driverName: 'John Doe',
    station: 'Bay 01',
    inDateTime: new Date('2026-08-14T08:30:00'),
    outDateTime: new Date('2026-08-14T14:00:00'),
    statusHistory: [
      { status: 'Entry', fromDateTime: new Date('2026-08-14T08:30:00'), toDateTime: new Date('2026-08-14T09:15:00'), remarks: 'Entered' },
      { status: 'Empty', fromDateTime: new Date('2026-08-14T09:15:00'), toDateTime: new Date('2026-08-14T10:30:00'), remarks: 'Waiting for loading' },
      { status: 'Loading', fromDateTime: new Date('2026-08-14T10:30:00'), toDateTime: new Date('2026-08-14T12:00:00'), remarks: 'Loading in progress' },
      { status: 'Under Maintenance', fromDateTime: new Date('2026-08-14T12:00:00'), toDateTime: new Date('2026-08-14T13:00:00'), remarks: 'Minor repair' },
      { status: 'Loaded', fromDateTime: new Date('2026-08-14T13:00:00'), toDateTime: new Date('2026-08-14T14:00:00'), remarks: 'Loading complete' },
    ],
  },
  {
    sessionId: 'SESS002',
    plant: 'Outside', // Non-plant vehicle example
    vehicleNumber: 'HR26XY5678',
    driverName: 'Jane Smith',
    station: 'Gate 2',
    inDateTime: new Date('2026-08-14T10:00:00'),
    outDateTime: null, // Still active
    statusHistory: [
      { status: 'Entry', fromDateTime: new Date('2026-08-14T10:00:00'), toDateTime: new Date('2026-08-14T11:00:00'), remarks: 'Arrived' },
      { status: 'Waiting', fromDateTime: new Date('2026-08-14T11:00:00'), toDateTime: null, remarks: 'Waiting for instructions' },
    ],
  },
];

// --- Component ---

const VehicleStatusReport: React.FC = () => {
  // In a real app, you'd use useEffect to fetch session data from an API.
  const sessions = mockVehicleSessions;

  return (
    <div>
      <h3>VT03 – Vehicle Status Report</h3>
      <table border={1} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Plant</th>
            <th>Vehicle Number</th>
            <th>Driver Name</th>
            <th>In Date Time</th>
            <th>Out Date Time</th>
            <th>Status</th>
            <th>From Status Date Time</th>
            <th>To Status Date Time</th>
            <th>Remarks</th>
            <th>Empty Stay (HH:MM)</th>
            <th>Load Stay (HH:MM)</th>
            <th>Maint. Stay (HH:MM)</th>
            <th>Station</th>
            <th>Total Stay (HH:MM)</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map(session => {
            const latestStatus = session.statusHistory[session.statusHistory.length - 1];
            return (
              <tr key={session.sessionId}>
                <td>{session.plant}</td>
                <td>{session.vehicleNumber}</td>
                <td>{session.driverName}</td>
                <td>{formatDate(session.inDateTime)}</td>
                <td>{formatDate(session.outDateTime)}</td>
                <td>{latestStatus.status}</td>
                <td>{formatDate(latestStatus.fromDateTime)}</td>
                <td>{formatDate(latestStatus.toDateTime)}</td>
                <td>{latestStatus.remarks}</td>
                <td>{calculateCategorizedStayHours(session.statusHistory, ['Empty'])}</td>
                <td>{calculateCategorizedStayHours(session.statusHistory, ['Loading', 'Loaded'])}</td>
                <td>{calculateCategorizedStayHours(session.statusHistory, ['Under Maintenance'])}</td>
                <td>{session.station}</td>
                <td>{formatDuration(session.inDateTime, session.outDateTime)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3 style={{marginTop: '2rem'}}>VT03 – Multiple Status History Example</h3>
      <p>Detailed history for session: {sessions[0].sessionId}</p>
       <table border={1} style={{ width: '60%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Vehicle</th>
            <th>Status</th>
            <th>From</th>
            <th>To</th>
            <th>Stay (HH:MM)</th>
          </tr>
        </thead>
        <tbody>
            {sessions[0].statusHistory.map((record, index) => (
                <tr key={index}>
                    <td>{sessions[0].vehicleNumber}</td>
                    <td>{record.status}</td>
                    <td>{formatDate(record.fromDateTime)}</td>
                    <td>{formatDate(record.toDateTime)}</td>
                    <td>{formatDuration(record.fromDateTime, record.toDateTime)}</td>
                </tr>
            ))}
        </tbody>
       </table>
    </div>
  );
};

export default VehicleStatusReport;