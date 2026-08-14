import React, { useState, useEffect } from 'react';
import { isValidMobileNumber, validateAndFormatVehicleNumber } from '../../../lib/validation';
import styles from '../../../../VT01.module.css';
import toast from 'react-hot-toast';

interface StatusHistoryRow {
  id: number;
  currentStatus: string;
  statusDateTime: string;
  toDateTime: string;
  remark: string;
}

const NonPlantVehicleTab: React.FC = () => {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [station, setStation] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVehicleCreated, setIsVehicleCreated] = useState(false);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryRow[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);

  const handleCreateVehicle = async () => {
    if (!vehicleNumber || !station) {
      toast.error('Vehicle Number and Station are mandatory.');
      return;
    }
    if (validationError) {
      toast.error('Please fix the validation error for Vehicle Number.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Creating Non-Plant Vehicle...');

    // Added default/placeholder fields to satisfy strict backend validators if it shares the main entry schema
    const vehicleData = {
      vehicleNo: vehicleNumber,
      station: station,
      plant: 'Outside',
      inDateTime: new Date().toISOString(),
      currentStatus: 'Entry',
      statusDateTime: new Date().toISOString(),
      transporter: 'N/A',
      driverName: 'N/A',
      driverMobile: '0000000000',
      materialType: 'N/A',
    };

    try {
      const response = await fetch('/api/vehicles/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create non-plant vehicle.');
      }

      const result = await response.json();
      setVehicleId(result.id);

      const initialStatus: StatusHistoryRow = {
        id: Date.now(), // Temporary client-side ID
        currentStatus: 'Entry',
        statusDateTime: new Date(vehicleData.inDateTime).toISOString().slice(0, 16),
        toDateTime: '',
        remark: '',
      };
      setStatusHistory([initialStatus]);
      setIsVehicleCreated(true);
      toast.success('Non-Plant Vehicle created successfully.', { id: toastId });
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewStatusRow = () => {
    const lastRow = statusHistory[statusHistory.length - 1];
    if (lastRow && !lastRow.toDateTime) {
      toast.error('Please set the "To Date Time" for the previous status before adding a new one.');
      return;
    }

    const defaultFrom = lastRow?.toDateTime || new Date().toISOString().slice(0, 16);

    const newRow: StatusHistoryRow = {
      id: Date.now(), // Temporary client-side ID
      currentStatus: '',
      statusDateTime: defaultFrom,
      toDateTime: '',
      remark: '',
    };
    setStatusHistory(prev => [...prev, newRow]);
  };

  const handlePostStatusUpdate = async (rowToSave: StatusHistoryRow) => {
    if (!rowToSave.currentStatus || !rowToSave.statusDateTime || !rowToSave.toDateTime) {
      toast.error('Please complete Status, From Date Time, and To Date Time.');
      return;
    }

    const fromDate = new Date(rowToSave.statusDateTime);
    const toDate = new Date(rowToSave.toDateTime);

    if (toDate.getTime() < fromDate.getTime()) {
      toast.error('"To Date Time" cannot be earlier than "From Date Time".');
      return;
    }

    const rowIndex = statusHistory.findIndex(r => r.id === rowToSave.id);
    if (rowIndex > 0) {
      const prevRow = statusHistory[rowIndex - 1];
      if (prevRow.toDateTime) {
        const prevToDate = new Date(prevRow.toDateTime);
        if (fromDate.getTime() < prevToDate.getTime()) {
          toast.error(`"From Date Time" cannot be earlier than the previous row's "To Date Time".`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Saving status update...');

    const statusUpdateData = {
      vehicleNo: vehicleNumber,
      plant: 'Outside', // Non-plant vehicles are always 'Outside'
      ...rowToSave,
    };

    try {
      const response = await fetch('/api/vehicles/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statusUpdateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update status.');
      }

      toast.success(`Status "${rowToSave.currentStatus}" saved successfully.`, { id: toastId });
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStatusRow = (id: number) => {
    setStatusHistory(prev => prev.filter(row => row.id !== id));
    toast.success('Row removed locally.');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto bg-white rounded-lg shadow-sm">
      {!isVehicleCreated && (
        <div className={styles.formContainer}>
          <div className={styles.formGroup}>
            <label htmlFor="vehicleNumber">Vehicle Number:</label>
            <input
              id="vehicleNumber"
              type="text"
              value={vehicleNumber}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                setVehicleNumber(value);
                const formatted = validateAndFormatVehicleNumber(value);
                if (!formatted && value) {
                  setValidationError('Please enter a valid Vehicle Number.');
                } else {
                  setValidationError('');
                }
              }}
              className={styles.formInput}
              placeholder="Enter Vehicle Number"
            />
            {validationError && <p className={styles.errorText}>{validationError}</p>}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="station">Station:</label>
            <input
              id="station"
              type="text"
              value={station}
              onChange={(e) => setStation(e.target.value)}
              className={styles.formInput}
              placeholder="Enter Station"
            />
          </div>
          <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
            <button onClick={handleCreateVehicle} disabled={isSubmitting} className={styles.button}>
              {isSubmitting ? 'Creating...' : 'Create Non-Plant Vehicle'}
            </button>
          </div>
        </div>
      )}

      {isVehicleCreated && (
        <div className="mt-8 border-t pt-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className={styles.header}>
              Status History for {vehicleNumber}
            </h2>
            <button 
              onClick={handleAddNewStatusRow} 
              className={styles.button}
            >
              Add Row
            </button>
          </div>

          <div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>From Date Time</th>
                  <th>To Date Time</th>
                  <th>Remark</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {statusHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                      No status history added. Click "Add Row" to begin.
                    </td>
                  </tr>
                ) : (
                  statusHistory.map((row, i) => (
                  <tr key={row.id}>
                    <td>
                      <div>
                        <select
                          aria-label="Status"
                          value={row.currentStatus}
                          onChange={(e) => {
                            const newHistory = [...statusHistory];
                            newHistory[i].currentStatus = e.target.value;
                            setStatusHistory(newHistory);
                          }}
                          className={styles.formInput}
                        >
                          <option value="">Select Status</option>
                          <option value="Empty Stay">Empty Stay</option>
                          <option value="Loaded Stay">Loaded Stay</option>
                          <option value="Dispatch">Dispatch</option>
                          <option value="Under Maintenance">Under Maintenance</option>
                        </select>
                      </div>
                    </td>

                    <td>
                      <div>
                        <input
                          type="datetime-local"
                          aria-label="From Date Time"
                          value={row.statusDateTime}
                          onChange={(e) => {
                            const newHistory = [...statusHistory];
                            newHistory[i].statusDateTime = e.target.value;
                            setStatusHistory(newHistory);
                          }}
                          className={styles.formInput}
                        />
                      </div>
                    </td>

                    <td>
                      <div>
                        <input
                          type="datetime-local"
                          aria-label="To Date Time"
                          value={row.toDateTime}
                          onChange={(e) => {
                            const newHistory = [...statusHistory];
                            newHistory[i].toDateTime = e.target.value;
                            setStatusHistory(newHistory);
                          }}
                          className={styles.formInput}
                        />
                      </div>
                    </td>

                    <td>
                      <input
                        type="text"
                        aria-label="Remark"
                        value={row.remark}
                        onChange={(e) => {
                          const newHistory = [...statusHistory];
                          newHistory[i].remark = e.target.value;
                          setStatusHistory(newHistory);
                        }}
                        placeholder="Remarks"
                        className={styles.formInput}
                      />
                    </td>

                    <td>
                      <button 
                        onClick={() => handlePostStatusUpdate(row)} 
                        disabled={isSubmitting} className={`${styles.button} ${styles.actionButton}`}
                      >
                        Save
                      </button>
                      <button 
                        onClick={() => handleDeleteStatusRow(row.id)} 
                        className={`${styles.button} ${styles.deleteButton} ${styles.actionButton}`} style={{ marginLeft: '8px' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default NonPlantVehicleTab;