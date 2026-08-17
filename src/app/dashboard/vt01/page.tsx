'use client';

import { useState, useEffect, useMemo, FC } from 'react';
import type { NextPage } from 'next';
import styles from '../../../../VT01.module.css';
import { useSearchParams } from 'next/navigation';
import { isValidMobileNumber, validateAndFormatVehicleNumber } from '../../../lib/validation';
import toast, { Toaster } from 'react-hot-toast';

// Custom Hooks for MongoDB Store Integration
import { useMongoStore, useCollectionOptimized, useMemoMongo, useUser } from '@/mongodb';
import { collection } from '@/lib/mongo-store';
import NonPlantVehicleTab from './NonPlantVehicleTab';

enum Tab {
  Entry = 'Entry',
  VehicleStatus = 'Vehicle Status',
  VehicleExit = 'Vehicle Exit',
  NonPlantVehicle = 'Non-Plant Vehicle',
}

const SHARED_HUB_ID = 'Sikkaind';

interface CNRow {
  id: number;
  cnNumber: string;
  cnDate: string; 
  shipToParty: string; 
  destination: string;
  totalPackage: number | string;
  totalWeight: number | string;
}

interface PlantOption {
  plantCode: string;
  plantName: string;
}

interface VehicleEntryData {
  plant: string;
  inDateTime: string;
  vehicleNo: string;
  driverName: string;
  driverMobile: string;
}

interface VehicleStatusData {
  plant: string;
  vehicleNo: string;
  driverName: string;
  driverMobile: string;
  currentStatus: 'Empty Stay' | 'Load Stay' | 'Under Maintenance' | '';
  statusUpdateDateTime: string;
  customer: string;
  shipToParty: string;
  destination: string;
  remark: string;
}

interface VehicleExitData {
  plant: string;
  vehicleNo: string;
  driverName: string;
  driverMobile: string;
  outType: 'Empty Vehicle' | 'Load Vehicle';
  exitDateTime: string;
}

interface StatusHistoryRow {
  id: number;
  currentStatus: string;
  statusDateTime: string;
  toDateTime: string;
  remark: string;
}

const formatDateTimeForInput = (date: Date): string => {
  const pad = (num: number) => num.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const calculateDuration = (from: string, to: string): string => {
  if (!from || !to) return '--:--';

  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (toDate.getTime() < fromDate.getTime()) return 'Invalid';

  const diffMs = toDate.getTime() - fromDate.getTime();
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const VT01Page: NextPage = () => {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Entry);
  const [cnRows, setCnRows] = useState<CNRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // MongoDB Real-time Data Store Setup
  const db = useMongoStore();
  const { user, isUserLoading: isAuthLoading } = useUser();

  const [inYardVehicles, setInYardVehicles] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [entryData, setEntryData] = useState<VehicleEntryData>({
    plant: '',
    inDateTime: '',
    vehicleNo: '',
    driverName: '',
    driverMobile: '',
  });

  const [validationErrors, setValidationErrors] = useState({
    vehicleNo: '',
    driverMobile: '',
  });

  const [statusData, setStatusData] = useState<VehicleStatusData>({
    plant: '',
    vehicleNo: '',
    driverName: '',
    driverMobile: '',
    currentStatus: '',
    statusUpdateDateTime: formatDateTimeForInput(new Date()),
    customer: '',
    shipToParty: '',
    destination: '',
    remark: ''
  });

  const [exitData, setExitData] = useState<VehicleExitData>({
    plant: '',
    vehicleNo: '',
    driverName: '',
    driverMobile: '',
    outType: 'Empty Vehicle',
    exitDateTime: formatDateTimeForInput(new Date())
  });

  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryRow[]>([]);
  const [vehicleStatusHistory, setVehicleStatusHistory] = useState<StatusHistoryRow[]>([]);
  const [newStatusRow, setNewStatusRow] = useState({ currentStatus: '', statusDateTime: formatDateTimeForInput(new Date()), toDateTime: '', remark: '' });

  const tcode = useMemo(() => searchParams.get('tcode'), [searchParams]);
  const [plantsList, setPlantsList] = useState<PlantOption[]>([]);
  const [plantsLoading, setPlantsLoading] = useState(true);

  useEffect(() => {
    if (isAuthLoading) return; // Wait for user authentication to complete

    const fetchPlants = async () => {
      setPlantsLoading(true);
      try {
        const response = await fetch('/api/plants');
        if (!response.ok) throw new Error('Unable to fetch Plant Master data.');
        const data = await response.json();
        const activePlants = data
          .filter((p: any) => p.status === 'Active')
          .map((p: any) => ({ plantCode: p.plantCode, plantName: p.plantName }));
        setPlantsList(activePlants);
      } catch (error) {
        console.error('Failed to fetch plants:', error);
        toast.error((error as Error).message || 'Failed to load plants.');
      } finally {
        setPlantsLoading(false);
      }
    };
    fetchPlants();
  }, [isAuthLoading]);

  // Set default selected Plant whenever plant list updates
  useEffect(() => {
    if (plantsList.length > 0) {
      const defaultPlant = plantsList[0].plantCode;
      setEntryData(prev => prev.plant ? prev : { ...prev, plant: defaultPlant });
      setStatusData(prev => prev.plant ? prev : { ...prev, plant: defaultPlant });
      setExitData(prev => prev.plant ? prev : { ...prev, plant: defaultPlant });
    }
  }, [plantsList]);

  // Set default IN Date Time on component mount
  useEffect(() => {
    setEntryData(prev => ({ ...prev, inDateTime: formatDateTimeForInput(new Date()) }));
  }, []);

  // Fetch in-yard vehicles when plant changes in Status or Exit tab
  useEffect(() => {
    const plant = activeTab === Tab.VehicleStatus ? statusData.plant : exitData.plant;

    if (!plant) {
      setInYardVehicles([]);
      return;
    }

    const fetchInYardVehicles = async () => {
      try {
        const response = await fetch(`/api/vehicles/in-yard?plant=${plant}`);
        if (response.ok) {
          const data = await response.json();
          setInYardVehicles(data);
        } else {
          setInYardVehicles([]);
        }
      } catch (err) {
        console.error(`Failed to fetch in-yard vehicles for plant ${plant}:`, err);
        setInYardVehicles([]);
      }
    };

    if (activeTab === Tab.VehicleStatus || activeTab === Tab.VehicleExit) {
      fetchInYardVehicles();
    }
  }, [activeTab, statusData.plant, exitData.plant]);

  // Auto-fetch vehicle details when selected in Status or Exit tab
  useEffect(() => {
    const vehicleNo = activeTab === Tab.VehicleStatus ? statusData.vehicleNo : exitData.vehicleNo;
    if (!vehicleNo) return;

    if (activeTab === Tab.VehicleStatus) {
      setStatusHistory([]); // Clear form for new entries
      setVehicleStatusHistory([]); // Clear displayed history
    }

    const vehicleDetails = inYardVehicles.find(v => v.vehicleNo === vehicleNo);
    if (vehicleDetails) {
      if (activeTab === Tab.VehicleStatus) {
        setStatusData(prev => ({
          ...prev,
          driverName: vehicleDetails.driverName,
          driverMobile: vehicleDetails.driverMobile,
        }));
        // Fetch status history for the selected vehicle
        const fetchStatusHistory = async () => {
          try {
            const response = await fetch(`/api/vehicles/status-history?vehicleNo=${vehicleNo}`);
            if (response.ok) {
              const history = await response.json();
              setVehicleStatusHistory(history);
            } else {
              toast.error('Could not fetch status history for the selected vehicle.');
            }
          } catch (error) {
            console.error('Failed to fetch status history:', error);
          }
        };
        fetchStatusHistory();
      } else if (activeTab === Tab.VehicleExit) {
        setExitData(prev => ({
          ...prev,
          driverName: vehicleDetails.driverName,
          driverMobile: vehicleDetails.driverMobile,
        }));
      }
    }
  }, [statusData.vehicleNo, exitData.vehicleNo, activeTab, inYardVehicles]);

  const handleAddRow = () => {
    setCnRows([...cnRows, {
      id: Date.now(),
      cnNumber: '', cnDate: '', shipToParty: '', destination: '', totalPackage: '', totalWeight: ''
    }]);
  };

  const handleSaveEntry = async () => {
    if (!entryData.plant || !entryData.vehicleNo || !entryData.driverName || !entryData.driverMobile) {
      toast.error('Please fill all fields in the Entry form.');
      return;
    }
    if (validationErrors.vehicleNo || validationErrors.driverMobile) {
      toast.error('Please fix the validation errors before saving.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Saving vehicle entry...');

    try {
      const response = await fetch('/api/vehicles/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...entryData,
          updatedBy: user?.email,
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save vehicle entry.');
      }
      toast.success('Vehicle Entry Saved Successfully!', { id: toastId });
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEntryChange = (field: keyof VehicleEntryData, value: string) => {
    setEntryData(prev => ({ ...prev, [field]: value }));

    if (field === 'vehicleNo') {
      const formatted = validateAndFormatVehicleNumber(value);
      if (!formatted && value) {
        setValidationErrors(prev => ({ ...prev, vehicleNo: 'Please enter a valid Vehicle Number.' }));
      } else {
        setValidationErrors(prev => ({ ...prev, vehicleNo: '' }));
      }
    }
    if (field === 'driverMobile') {
      if (!isValidMobileNumber(value) && value) {
        setValidationErrors(prev => ({ ...prev, driverMobile: 'Mobile number must be exactly 10 digits.' }));
      } else {
        setValidationErrors(prev => ({ ...prev, driverMobile: '' }));
      }
    }
  };

  const handleStatusChange = (field: keyof VehicleStatusData, value: string) => {
    setStatusData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddNewStatusRow = () => {
    const newRow: StatusHistoryRow = {
      id: Date.now(), // Temporary ID for local state
      currentStatus: '',
      statusDateTime: statusHistory.length > 0 ? statusHistory[statusHistory.length - 1].toDateTime : formatDateTimeForInput(new Date()),
      toDateTime: '',
      remark: '',
    };
    setStatusHistory(prev => [...prev, newRow]);
  };

  const handleAddStatusRow = () => {
    if (!newStatusRow.currentStatus || !newStatusRow.statusDateTime || !newStatusRow.toDateTime) {
      toast.error('Please provide Status, From Date Time, and To Date Time.');
      return;
    }

    const fromDate = new Date(newStatusRow.statusDateTime);
    const toDate = new Date(newStatusRow.toDateTime);

    // Rule: to date time not should be lower from date time
    if (toDate < fromDate) {
      toast.error('"To Date Time" cannot be earlier than "From Date Time".');
      return;
    }

    // Rule: from/to date time not should be lower from previous to date and time
    if (statusHistory.length > 0) {
      const lastStatus = statusHistory[statusHistory.length - 1];
      if (lastStatus.toDateTime) {
        const lastToDate = new Date(lastStatus.toDateTime);
        if (fromDate < lastToDate) {
          toast.error('"From Date Time" cannot be earlier than the previous status\'s "To Date Time".');
          return;
        }
      }
    }

    setStatusHistory(prev => [...prev, { id: Date.now(), ...newStatusRow }]);
    setNewStatusRow({
      currentStatus: '',
      statusDateTime: newStatusRow.toDateTime, // Pre-fill next 'from' with previous 'to'
      toDateTime: '',
      remark: ''
    });
    toast.success('Status row added locally.');
  };

  const handleDeleteStatusRow = (id: number) => {
    setStatusHistory(prev => prev.filter(row => row.id !== id));
    toast.success('Row removed locally.');
  };
  const handleExitChange = (field: keyof VehicleExitData, value: string) => {
    setExitData(prev => ({ ...prev, [field]: value }));
  };

  const handlePostStatusUpdate = async (rowToSave: StatusHistoryRow) => {
    if (!rowToSave.currentStatus || !rowToSave.statusDateTime || !rowToSave.toDateTime) {
      toast.error('Please provide Status, From Date Time, and To Date Time.');
      return;
    }

    const fromDate = new Date(rowToSave.statusDateTime);
    const toDate = new Date(rowToSave.toDateTime);

    // Rule: to date time not should be lower from date time
    if (toDate < fromDate) {
      toast.error('"To Date Time" cannot be earlier than "From Date Time".');
      return;
    }
  
    const rowIndex = statusHistory.findIndex(r => r.id === rowToSave.id);
    if (rowIndex > 0) {
      const prevRow = statusHistory[rowIndex - 1];
      const prevToDate = new Date(prevRow.toDateTime);
      if (fromDate < prevToDate) {
        toast.error(`"From Date Time" cannot be earlier than the previous row's "To Date Time" (${prevRow.toDateTime}).`);
        return;
      }
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Updating status...');
    
    try {
      // Assuming the API can handle adding a new status history entry
      const response = await fetch('/api/vehicles/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plant: statusData.plant,
          vehicleNo: statusData.vehicleNo,
          customer: statusData.customer,
          updatedBy: user?.email,
          shipToParty: statusData.shipToParty,
          destination: statusData.destination,
          ...rowToSave,
        }),
      });

      if (!response.ok) throw new Error('Failed to update status.');

      // Assuming API returns the full updated history for the vehicle
      const updatedHistory = await response.json(); 
      setStatusHistory(updatedHistory);
      setShowUpdatePopup(false);
      toast.success('Status updated successfully!', { id: toastId });
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkVehicleOut = async () => {
    if (!exitData.plant || !exitData.vehicleNo || !exitData.exitDateTime) {
      toast.error('Please select a plant and vehicle before marking it OUT.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Marking vehicle out...');

    try {
      const response = await fetch('/api/vehicles/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...exitData,
          cnRows,
          updatedBy: user?.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Unable to mark vehicle OUT.');
      }
      toast.success('Vehicle marked as OUT successfully!', { id: toastId });
      setCnRows([]);
      setExitData((previous) => ({ ...previous, vehicleNo: '', driverName: '', driverMobile: '' }));
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCNNumberChange = async (id: number, cnNumber: string) => {
    const newRows = [...cnRows];
    const rowIndex = newRows.findIndex(row => row.id === id);
    if (rowIndex === -1) return;

    newRows[rowIndex].cnNumber = cnNumber;

    if (cnNumber) {
      try {
        const response = await fetch(`/api/cn-details?cn=${cnNumber}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'CN Number is invalid/not found.');
        }
        const data = await response.json();
        newRows[rowIndex] = {
          ...newRows[rowIndex],
          shipToParty: data.shipToParty,
          destination: data.destination,
        };
        setError(null);
      } catch (err) {
        setError((err as Error).message);
        const { cnNumber } = newRows[rowIndex];
        newRows[rowIndex] = {
          ...newRows[rowIndex],
          cnNumber,
          shipToParty: '',
          destination: '',
        };
      }
    }
    setCnRows(newRows);
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case Tab.NonPlantVehicle:
        return <NonPlantVehicleTab />;
      case Tab.VehicleStatus:
        return (
          <div className={styles.formContainer}>
            <div className={styles.formGroup}>
              <label>Plant:</label>
              <select 
                value={statusData.plant} 
                onChange={(e) => handleStatusChange('plant', e.target.value)} 
                className={styles.formInput}
              >
                <option value="">Select Plant...</option>
                {plantsLoading && <option disabled>Loading plants...</option>}
                {!plantsLoading && plantsList.length === 0 && (
                  <option disabled>No active plants found.</option>
                )}
                {plantsList.length > 0 &&
                  plantsList.map((p) => (
                  <option key={p.plantCode} value={p.plantCode}>
                    {p.plantCode} - {p.plantName}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Vehicle Number:</label>
              <select value={statusData.vehicleNo} onChange={(e) => handleStatusChange('vehicleNo', e.target.value)} className={styles.formInput}>
                <option value="">Select Vehicle...</option>
                {inYardVehicles.length === 0 && <option disabled>No vehicles in yard for this plant</option>}
                {inYardVehicles.map(v => (
                  <option key={v.id} value={v.vehicleNo}>{v.vehicleNo}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Driver Name:</label>
              <input type="text" value={statusData.driverName} disabled className={styles.formInput} placeholder="Auto-fetch"/>
            </div>
            <div className={styles.formGroup}>
              <label>Driver Mobile:</label>
              <input type="text" value={statusData.driverMobile} disabled className={styles.formInput} placeholder="Auto-fetch"/>
            </div>
            <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className={styles.header}>Status History</h3>
                <button onClick={handleAddNewStatusRow} className={styles.button} style={{ marginBottom: '1rem' }}>
                  Add Row
                </button>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>From Date Time</th>
                    <th>To Date Time</th>
                    <th>Duration</th>
                    <th>Remark</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {statusHistory.map((row, i) => (
                    <tr key={row.id}>
                      <td>
                        <select
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
                          <option value="Load Stay">Load Stay</option>
                          <option value="Under Maintenance">Under Maintenance</option>
                          <option value="In-Transit">In-Transit</option>
                          <option value="Stay at Customer">Stay at Customer</option>
                          <option value="Under Loading">Under Loading</option>
                          <option value="Under Unloading">Under Unloading</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="datetime-local"
                          value={row.statusDateTime || ''}
                          onChange={(e) => {
                            const newHistory = [...statusHistory];
                            newHistory[i].statusDateTime = e.target.value;
                            setStatusHistory(newHistory);
                          }}
                          className={styles.formInput}
                        />
                      </td>
                      <td>
                        <input
                          type="datetime-local"
                          value={row.toDateTime || ''}
                          onChange={(e) => {
                            const newHistory = [...statusHistory];
                            newHistory[i].toDateTime = e.target.value;
                            setStatusHistory(newHistory);
                          }}
                          className={styles.formInput}
                        />
                      </td>
                      <td>
                        <span className={styles.durationText}>{calculateDuration(row.statusDateTime, row.toDateTime)}</span>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.remark || ''}
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
                        <button onClick={() => handlePostStatusUpdate(row)} className={`${styles.button} ${styles.actionButton}`}>Save</button>
                        <button onClick={() => handleDeleteStatusRow(row.id)} className={`${styles.button} ${styles.deleteButton} ${styles.actionButton}`} style={{ marginLeft: '8px' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {statusData.vehicleNo && (
              <div style={{ gridColumn: 'span 2', marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                <h3 className={styles.header}>Vehicle Updated Status</h3>
                {vehicleStatusHistory.length > 0 ? (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>From Date Time</th>
                        <th>To Date Time</th>
                        <th>Duration</th>
                        <th>Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicleStatusHistory.map((row) => (
                        <tr key={row.id}>
                          <td>{row.currentStatus}</td>
                          <td>{new Date(row.statusDateTime).toLocaleString()}</td>
                          <td>{row.toDateTime ? new Date(row.toDateTime).toLocaleString() : 'N/A'}</td>
                          <td>{calculateDuration(row.statusDateTime, row.toDateTime)}</td>
                          <td>{row.remark}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ textAlign: 'center', padding: '1rem', color: '#888' }}>
                    No status history found for this vehicle.
                  </p>
                )}
              </div>
            )}

            {/* 
              <label>Current Status:</label>
              <select value={statusData.currentStatus} onChange={(e) => handleStatusChange('currentStatus', e.target.value as any)} className={styles.formInput}>
                <option value="">Select Status</option>
                <option value="Empty Stay">Empty Stay</option>
                <option value="Load Stay">Load Stay</option>
                <option value="Under Maintenance">Under Maintenance</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Status Update Date Time:</label>
              <input type="datetime-local" value={statusData.statusUpdateDateTime} onChange={(e) => handleStatusChange('statusUpdateDateTime', e.target.value)} className={styles.formInput} />
            </div> */}

            {/*
            <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                <button onClick={handlePostStatusUpdate} disabled={isSubmitting || statusHistory.length === 0} className={styles.button}>
                    {isSubmitting ? 'Saving...' : 'Save All Statuses'}
                </button>
            </div>
            <div className={styles.formGroup}>
              <label>Remark:</label>
              <textarea value={statusData.remark} onChange={(e) => handleStatusChange('remark', e.target.value)} className={styles.formInput} />
            </div>
            {statusData.currentStatus && (
              <button onClick={() => setShowUpdatePopup(true)} className={styles.button}>Update Status</button>
            )}
            
            {showUpdatePopup && (
              <div className={styles.popup}>
                <div className={styles.popupContent}>
                  <h3>Update Vehicle Status</h3>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>S.No</th><th>Plant</th><th>Vehicle No</th><th>Current Status</th><th>Status Date Time</th><th>Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusHistory.map((row, i) => (
                        <tr key={row.id}><td>{i+1}</td><td>{statusData.plant}</td><td>{statusData.vehicleNo}</td><td>{row.currentStatus}</td><td>{row.statusDateTime}</td><td>{row.remark}</td></tr>
                      ))}
                      <tr>
                        <td>{statusHistory.length + 1}</td>
                        <td>{statusData.plant}</td>
                        <td>{statusData.vehicleNo}</td>
                        <td><select value={newStatusRow.currentStatus} onChange={e => setNewStatusRow(p => ({...p, currentStatus: e.target.value}))}><option value="">Select</option><option>Empty Stay</option><option>Load Stay</option><option>Under Maintenance</option></select></td>
                        <td><input type="datetime-local" value={newStatusRow.statusDateTime} onChange={e => setNewStatusRow(p => ({...p, statusDateTime: e.target.value}))} /></td>
                        <td><input type="text" value={newStatusRow.remark} onChange={e => setNewStatusRow(p => ({...p, remark: e.target.value}))} /></td>
                      </tr>
                    </tbody>
                  </table>
                  <div className={styles.buttonGroup}>
                    <button onClick={handlePostStatusUpdate} className={styles.button}>Post</button>
                    <button onClick={() => setShowUpdatePopup(false)} className={styles.buttonSecondary}>Cancel</button>
                  </div>
                </div>
              </div>
            )} */}
          </div>
        );
      case Tab.VehicleExit:
        return (
          <div className={styles.formContainer}>
            <div className={styles.formGroup}>
              <label>Plant: </label>
              <select 
                value={exitData.plant} 
                onChange={(e) => handleExitChange('plant', e.target.value)} 
                className={styles.formInput}
              >
                <option value="">Select Plant...</option>
                {plantsLoading && <option disabled>Loading plants...</option>}
                {!plantsLoading && plantsList.length === 0 && (
                  <option disabled>No active plants found.</option>
                )}
                {plantsList.length > 0 &&
                  plantsList.map((p) => (
                  <option key={p.plantCode} value={p.plantCode}>
                    {p.plantCode} - {p.plantName}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Vehicle Number: </label>
              <select 
                value={exitData.vehicleNo} 
                onChange={(e) => handleExitChange('vehicleNo', e.target.value)} 
                className={styles.formInput}
              >
                <option value="">Select Active IN Vehicle...</option>
                {inYardVehicles.length === 0 && <option disabled>No vehicles in yard for this plant</option>}
                {inYardVehicles.map(v => (
                  <option key={v.id} value={v.vehicleNo}>{v.vehicleNo}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Driver Name: </label>
              <input 
                type="text" 
                value={exitData.driverName} 
                disabled 
                className={styles.formInput} 
                placeholder="Auto-fetch Driver Name" 
              />
            </div>

            <div className={styles.formGroup}>
              <label>Driver Mobile: </label>
              <input 
                type="text" 
                value={exitData.driverMobile} 
                disabled 
                className={styles.formInput} 
                placeholder="Auto-fetch Driver Mobile" 
              />
            </div>

            <div className={styles.formGroup}>
              <label>Out Type: </label>
              <select 
                value={exitData.outType} 
                onChange={(e) => handleExitChange('outType', e.target.value as any)}
                className={styles.formInput}
              >
                <option value="Empty Vehicle">Empty Vehicle</option>
                <option value="Load Vehicle">Load Vehicle</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Exit Date Time: </label>
              <input 
                type="datetime-local" 
                value={exitData.exitDateTime} 
                onChange={(e) => handleExitChange('exitDateTime', e.target.value)} 
                className={styles.formInput} 
              />
            </div>

            {exitData.outType === 'Load Vehicle' && (
              <div style={{ marginTop: '20px', gridColumn: 'span 2' }}>
              <div style={{ marginTop: '0px' }}>
                <h4 className={styles.header}>Consignment Notes (CN Number, Destination, Customer fields removed)</h4>
                {error && <p className={styles.errorText}>{error}</p>}
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>CN Number</th>
                      <th>CN Date</th>
                      <th>Ship to Party</th>
                      <th>Destination</th>
                      <th>Total Package</th>
                      <th>Total Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cnRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="999999"
                            step="1"
                            value={row.cnNumber}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || (/^\d{1,6}$/.test(value) && Number(value) <= 999999)) {
                                handleCNNumberChange(row.id, value);
                              }
                            }}
                            placeholder="Enter CN Number"
                            className={styles.formInput}
                          />
                        </td>
                        <td>{row.cnDate}</td>
                        <td>{row.shipToParty}</td>
                        <td>{row.destination}</td>
                        <td>{row.totalPackage}</td>
                        <td>{row.totalWeight}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={handleAddRow} className={styles.button} style={{ marginTop: '10px' }}>Add Row</button>
              </div>
              </div>
            )}

            <div style={{ marginTop: '20px', gridColumn: 'span 2' }}>
              <button onClick={handleMarkVehicleOut} disabled={isSubmitting} className={styles.button} style={{ backgroundColor: '#dc2626' }}>
                {isSubmitting ? 'Processing...' : 'Mark Vehicle OUT'}
              </button>
            </div>
          </div>
        );
      case Tab.Entry:
      default:
        return (
          <div className={styles.formContainer}>
            <div className={styles.formGroup}>
              <label>Plant: </label>
              <select
                value={entryData.plant}
                onChange={(e) => handleEntryChange('plant', e.target.value)}
                className={styles.formInput}
              >
                <option value="">Select Plant...</option>
                {plantsLoading && <option disabled>Loading plants...</option>}
                {!plantsLoading && plantsList.length === 0 && (
                  <option disabled>No active plants found.</option>
                )}
                {plantsList.length > 0 &&
                  plantsList.map((p) => (
                  <option key={p.plantCode} value={p.plantCode}>
                    {p.plantCode} - {p.plantName}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>IN Date Time: </label>
              <input
                type="datetime-local"
                value={entryData.inDateTime}
                onChange={(e) => handleEntryChange('inDateTime', e.target.value)}
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Vehicle Number: </label>
              <input
                type="text"
                value={entryData.vehicleNo}
                onChange={(e) => handleEntryChange('vehicleNo', e.target.value.toUpperCase())}
                placeholder="E.G. UP14GT0600"
                className={styles.formInput}
              />
              {validationErrors.vehicleNo && <p className={styles.errorText}>{validationErrors.vehicleNo}</p>}
            </div>

            <div className={styles.formGroup}>
              <label>Driver Name: </label>
              <input
                type="text"
                value={entryData.driverName}
                onChange={(e) => handleEntryChange('driverName', e.target.value.toUpperCase())}
                placeholder="Enter Driver Name"
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Driver Mobile: </label>
              <input
                type="tel"
                value={entryData.driverMobile}
                onChange={(e) => handleEntryChange('driverMobile', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                maxLength={10}
                placeholder="Enter 10-digit Mobile"
                className={styles.formInput}
              />
              {validationErrors.driverMobile && <p className={styles.errorText}>{validationErrors.driverMobile}</p>}
            </div>
            
            <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                <button onClick={handleSaveEntry} disabled={isSubmitting} className={styles.button}>
                    {isSubmitting ? 'Saving...' : 'Save Entry'}
                </button>
            </div>
          </div>
        );


    }
  };

  return (
    <div className={styles.container}>
      <Toaster position="top-center" reverseOrder={false} />
      <h1 className={styles.headerTitle}>VT01 - Vehicle Entry / Create</h1>
      <div className={styles.tabContainer}>
        <button onClick={() => setActiveTab(Tab.Entry)} disabled={activeTab === Tab.Entry} className={styles.tabButton}>Entry</button>
        <button onClick={() => setActiveTab(Tab.VehicleStatus)} disabled={activeTab === Tab.VehicleStatus} className={styles.tabButton}>Vehicle Status</button>
        <button onClick={() => setActiveTab(Tab.VehicleExit)} disabled={activeTab === Tab.VehicleExit} className={styles.tabButton}>
          Vehicle Exit
        </button>
        <button onClick={() => setActiveTab(Tab.NonPlantVehicle)} disabled={activeTab === Tab.NonPlantVehicle} className={styles.tabButton}>
          Non-Plant Vehicle
        </button>
      </div>
      <div className={styles.tabContent}>
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default VT01Page;
