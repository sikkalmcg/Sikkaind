import React, { useState, useEffect } from 'react';

// --- Type Definitions ---
// Represents a single status record for a vehicle.
interface StatusRecord {
  status: string;
  fromDateTime: Date;
  toDateTime: Date | null;
  remarks: string;
}

// Represents the active vehicle's data.
interface Vehicle {
  id: string;
  // other vehicle properties...
  statusHistory: StatusRecord[];
}

// Props for the VehicleStatus component.
interface VehicleStatusProps {
  vehicleId: string;
  isVehicleIn: boolean; // Is the vehicle currently active/IN
  vehicleExitTime?: Date; // The time the vehicle was marked OUT
}

// --- Component ---
const VehicleStatus: React.FC<VehicleStatusProps> = ({ vehicleId, isVehicleIn, vehicleExitTime }) => {
  // State to hold the vehicle's status history.
  // In a real app, this would likely come from a state management library or an API call.
  const [statusHistory, setStatusHistory] = useState<StatusRecord[]>([
    // Initial entry record for demonstration
    { status: 'Entry', fromDateTime: new Date('2026-08-14T08:30:00'), toDateTime: new Date('2026-08-14T09:15:00'), remarks: 'Vehicle entered' },
    { status: 'Waiting', fromDateTime: new Date('2026-08-14T09:15:00'), toDateTime: new Date('2026-08-14T10:30:00'), remarks: 'Waiting for loading' },
    { status: 'Loading', fromDateTime: new Date('2026-08-14T10:30:00'), toDateTime: new Date('2026-08-14T12:00:00'), remarks: 'Loading in progress' },
    { status: 'Loaded', fromDateTime: new Date('2026-08-14T12:00:00'), toDateTime: null, remarks: 'Loading completed' },
  ]);

  /**
   * Handles closing the latest status when a vehicle exits.
   */
  useEffect(() => {
    if (!isVehicleIn && vehicleExitTime && statusHistory.length > 0) {
      const lastStatus = statusHistory[statusHistory.length - 1];
      if (lastStatus.toDateTime === null) {
        const updatedHistory = [...statusHistory];
        updatedHistory[updatedHistory.length - 1] = {
          ...lastStatus,
          toDateTime: vehicleExitTime,
        };
        setStatusHistory(updatedHistory);
      }
    }
  }, [isVehicleIn, vehicleExitTime, statusHistory]);

  /**
   * Adds a new status record to the history.
   */
  const handleAddRow = (newStatus: Omit<StatusRecord, 'toDateTime'>) => {
    if (!isVehicleIn) {
      console.warn("Cannot add new status to a vehicle that is not IN.");
      return;
    }

    const newRecord: StatusRecord = { ...newStatus, toDateTime: null };

    setStatusHistory(prevHistory => {
      if (prevHistory.length > 0) {
        // Get the previous status to update its 'toDateTime'.
        const lastRecord = prevHistory[prevHistory.length - 1];
        const updatedLastRecord = { ...lastRecord, toDateTime: newRecord.fromDateTime };
        
        // Return history with updated previous record and the new record.
        return [...prevHistory.slice(0, -1), updatedLastRecord, newRecord];
      }
      return [newRecord]; // Add as the first record if history is empty.
    });
  };

  // --- Helper for demonstration ---
  const addSampleRow = () => {
    // This is a placeholder for a form/modal to add a new status.
    const newStatusData = {
        status: 'New Status',
        fromDateTime: new Date(),
        remarks: 'This is a new status.'
    };
    handleAddRow(newStatusData);
  }

  // --- Render ---
  return (
    <div>
      {/* The label is changed from "Current Status" to "Status" */}
      <h3>Status</h3>
      
      {isVehicleIn && (
        <button onClick={addSampleRow} style={{ marginBottom: '10px' }}>
          Add Row
        </button>
      )}

      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>From Status Date Time</th>
            <th>To Status Date Time</th>
            <th>Remarks</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {statusHistory.map((record, index) => (
            <tr key={index}>
              <td>{record.status}</td>
              <td>{record.fromDateTime.toLocaleString()}</td>
              <td>{record.toDateTime ? record.toDateTime.toLocaleString() : '—'}</td>
              <td>{record.remarks}</td>
              <td>
                {/* The last record for an active vehicle has an Edit action */}
                {index === statusHistory.length - 1 && record.toDateTime === null && isVehicleIn ? (
                  <button>Edit</button>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default VehicleStatus;