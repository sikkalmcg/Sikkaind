import React, { useState, useEffect } from 'react';

// --- Type Definitions ---
// Represents a single status record for a vehicle.
interface StatusRecord {
  status: string;
  fromDateTime: string; // Using string to easily bind to datetime-local input
  toDateTime: string | null;
  remarks: string;
}

// Props for the EditVehicleStatus component.
interface EditVehicleStatusProps {
  vehicleId: string;
  isVehicleIn: boolean; // Is the vehicle currently active/IN
  vehicleExitTime?: Date; // The time the vehicle was marked OUT
}

// --- Component ---
/**
 * A component for "VT02 – Edit Vehicle Status", providing an editable
 * history of a vehicle's statuses.
 */
const EditVehicleStatus: React.FC<EditVehicleStatusProps> = ({ vehicleId, isVehicleIn, vehicleExitTime }) => {
  // State to hold the vehicle's status history.
  // In a real app, this would be fetched from an API based on vehicleId.
  const [statusHistory, setStatusHistory] = useState<StatusRecord[]>([
    // Initial entry record for demonstration, using ISO-like strings for inputs
    { status: 'Entry', fromDateTime: '2026-08-14T08:30', toDateTime: '2026-08-14T09:15', remarks: 'Vehicle entered' },
    { status: 'Waiting', fromDateTime: '2026-08-14T09:15', toDateTime: '2026-08-14T10:30', remarks: 'Waiting for loading' },
    { status: 'Loading', fromDateTime: '2026-08-14T10:30', toDateTime: '2026-08-14T12:00', remarks: 'Loading in progress' },
    { status: 'Loaded', fromDateTime: '2026-08-14T12:00', toDateTime: null, remarks: 'Loading completed' },
  ]);

  /**
   * Handles closing the latest status when a vehicle is marked as OUT.
   */
  useEffect(() => {
    if (!isVehicleIn && vehicleExitTime && statusHistory.length > 0) {
      const lastStatus = statusHistory[statusHistory.length - 1];
      if (lastStatus.toDateTime === null) {
        const updatedHistory = [...statusHistory];
        // Format exit time for the input
        const exitTimeStr = vehicleExitTime.toISOString().slice(0, 16);
        updatedHistory[updatedHistory.length - 1] = {
          ...lastStatus,
          toDateTime: exitTimeStr,
        };
        setStatusHistory(updatedHistory);
      }
    }
  }, [isVehicleIn, vehicleExitTime, statusHistory]);

  /**
   * Generic handler to update a field for a specific status record.
   */
  const handleRecordChange = (index: number, field: keyof StatusRecord, value: string) => {
    const updatedHistory = [...statusHistory];
    updatedHistory[index] = { ...updatedHistory[index], [field]: value };
    setStatusHistory(updatedHistory);
  };

  /**
   * Adds a new status record, maintaining the From/To date logic.
   */
  const handleAddRow = () => {
    if (!isVehicleIn) {
      console.warn("Cannot add new status to a vehicle that is not IN.");
      return;
    }

    const now = new Date();
    const newFromDateTime = now.toISOString().slice(0, 16);

    const newRecord: StatusRecord = {
      status: '',
      fromDateTime: newFromDateTime,
      toDateTime: null,
      remarks: ''
    };

    setStatusHistory(prevHistory => {
      if (prevHistory.length > 0) {
        const lastRecord = prevHistory[prevHistory.length - 1];
        // Update previous status's 'toDateTime'
        const updatedLastRecord = { ...lastRecord, toDateTime: newFromDateTime };
        return [...prevHistory.slice(0, -1), updatedLastRecord, newRecord];
      }
      return [newRecord];
    });
  };

  const handleSaveChanges = () => {
    // Here you would implement the logic to save the `statusHistory` state.
    // This would typically involve an API call to your backend.
    console.log("Saving changes for vehicle:", vehicleId, statusHistory);
    alert("Changes saved! Check the console for the updated data.");
  };

  // --- Render ---
  return (
    <div>
      <h3>Edit Vehicle Status (VT02)</h3>

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
              <td>
                <input type="text" value={record.status} onChange={(e) => handleRecordChange(index, 'status', e.target.value)} />
              </td>
              <td>
                <input type="datetime-local" value={record.fromDateTime} onChange={(e) => handleRecordChange(index, 'fromDateTime', e.target.value)} />
              </td>
              <td>
                {/* To DateTime is auto-managed, so it's read-only */}
                <input type="datetime-local" value={record.toDateTime || ''} readOnly disabled />
              </td>
              <td>
                <input type="text" value={record.remarks} onChange={(e) => handleRecordChange(index, 'remarks', e.target.value)} />
              </td>
              <td>—</td>
            </tr>
          ))}
        </tbody>
      </table>

      {isVehicleIn && (
        <button onClick={handleAddRow} style={{ marginTop: '10px' }}>
          Add New Status
        </button>
      )}

      <button onClick={handleSaveChanges} style={{ marginTop: '20px', marginLeft: '10px', fontWeight: 'bold' }}>
        Save Changes
      </button>
    </div>
  );
};

export default EditVehicleStatus;