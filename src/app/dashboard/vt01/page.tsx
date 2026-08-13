'use client';

import { useState, useEffect, useMemo } from 'react';
import type { NextPage } from 'next';
import styles from '../../../../VT01.module.css';
import { useSearchParams } from 'next/navigation';
import { isValidMobileNumber, validateAndFormatVehicleNumber } from '../../../lib/validation';

// Custom Hooks for MongoDB Store Integration
import { useMongoStore, useCollectionOptimized, useMemoMongo, useUser } from '@/mongodb';
import { collection } from '@/lib/mongo-store';

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

const VT01Page: NextPage = () => {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'Entry' | 'Vehicle Status' | 'Vehicle Exit'>('Entry');
  const [cnRows, setCnRows] = useState<CNRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // MongoDB Real-time Data Store Setup
  const db = useMongoStore();
  const { user, isUserLoading: isAuthLoading } = useUser();

  const plantsQuery = useMemoMongo(() => {
    if (isAuthLoading || !user) return null;
    return collection(db, 'users', SHARED_HUB_ID, 'plants');
  }, [db, user, isAuthLoading]);

  const { data: rawPlants, isLoading: plantsLoading } = useCollectionOptimized(plantsQuery);

  // Filter Active Plants and format list
  const plantsList: PlantOption[] = useMemo(() => {
    if (!rawPlants) return [];
    return rawPlants
      .filter((p: any) => p.status === 'Active')
      .map((p: any) => ({
        plantCode: p.plantCode,
        plantName: p.plantName,
      }));
  }, [rawPlants]);

  const [inYardVehicles, setInYardVehicles] = useState<any[]>([]);

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
  const [newStatusRow, setNewStatusRow] = useState({ currentStatus: '', statusDateTime: formatDateTimeForInput(new Date()), remark: '' });

  const tcode = useMemo(() => searchParams.get('tcode'), [searchParams]);

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
    const plant = activeTab === 'Vehicle Status' ? statusData.plant : exitData.plant;

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

    if (activeTab === 'Vehicle Status' || activeTab === 'Vehicle Exit') {
      fetchInYardVehicles();
    }
  }, [activeTab, statusData.plant, exitData.plant]);

  // Auto-fetch vehicle details when selected in Status or Exit tab
  useEffect(() => {
    const vehicleNo = activeTab === 'Vehicle Status' ? statusData.vehicleNo : exitData.vehicleNo;
    if (!vehicleNo) return;

    const vehicleDetails = inYardVehicles.find(v => v.vehicleNo === vehicleNo);
    if (vehicleDetails) {
      if (activeTab === 'Vehicle Status') {
        setStatusData(prev => ({
          ...prev,
          driverName: vehicleDetails.driverName,
          driverMobile: vehicleDetails.driverMobile,
        }));
      } else if (activeTab === 'Vehicle Exit') {
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
      alert('Please fill all fields in the Entry form.');
      return;
    }
    if (validationErrors.vehicleNo || validationErrors.driverMobile) {
      alert('Please fix the validation errors before saving.');
      return;
    }

    try {
      const response = await fetch('/api/vehicles/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save vehicle entry.');
      }
      alert('Vehicle Entry Saved Successfully!');
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
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

  const handleExitChange = (field: keyof VehicleExitData, value: string) => {
    setExitData(prev => ({ ...prev, [field]: value }));
  };

  const handlePostStatusUpdate = async () => {
    if (!newStatusRow.currentStatus || !newStatusRow.remark) {
      alert('Please select a status and provide a remark.');
      return;
    }

    try {
      const response = await fetch('/api/vehicles/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plant: statusData.plant,
          vehicleNo: statusData.vehicleNo,
          customer: statusData.customer,
          shipToParty: statusData.shipToParty,
          destination: statusData.destination,
          ...newStatusRow,
        }),
      });

      if (!response.ok) throw new Error('Failed to update status.');

      const updatedHistory = await response.json();
      setStatusHistory(updatedHistory);
      setShowUpdatePopup(false);
      alert('Status updated successfully!');
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  const handleMarkVehicleOut = () => {
    if (!exitData.plant || !exitData.vehicleNo || !exitData.exitDateTime) {
      alert('Please select a plant and vehicle before marking it OUT.');
      return;
    }
    fetch('/api/vehicles/exit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...exitData, cnRows }),
    }).then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Unable to mark vehicle OUT.');
        }
        alert('Vehicle marked as OUT successfully!');
        setCnRows([]);
        setExitData((previous) => ({ ...previous, vehicleNo: '', driverName: '', driverMobile: '' }));
      })
      .catch((err) => {
        alert(`Error: ${(err as Error).message}`);
      });
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
      case 'Vehicle Status':
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
            <div className={styles.formGroup}>
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
            </div>
            {statusData.currentStatus === 'Load Stay' && (
              <>
                <div className={styles.formGroup}>
                  <label>Customer:</label>
                  <input type="text" value={statusData.customer} onChange={(e) => handleStatusChange('customer', e.target.value)} className={styles.formInput} />
                </div>
                <div className={styles.formGroup}>
                  <label>Ship to Party:</label>
                  <input type="text" value={statusData.shipToParty} onChange={(e) => handleStatusChange('shipToParty', e.target.value)} className={styles.formInput} />
                </div>
                <div className={styles.formGroup}>
                  <label>Destination:</label>
                  <input type="text" value={statusData.destination} onChange={(e) => handleStatusChange('destination', e.target.value)} className={styles.formInput} />
                </div>
              </>
            )}
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
            )}
          </div>
        );
      case 'Vehicle Exit':
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
              <div style={{ marginTop: '20px' }}>
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
              <button onClick={handleMarkVehicleOut} className={styles.button} style={{ backgroundColor: '#dc2626' }}>
                Mark Vehicle OUT
              </button>
            </div>
          </div>
        );
      case 'Entry':
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
                <button onClick={handleSaveEntry} className={styles.button}>
                    Save Entry
                </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.headerTitle}>VT01 - Vehicle Entry / Create</h1>
      <div className={styles.tabContainer}>
        <button onClick={() => setActiveTab('Entry')} disabled={activeTab === 'Entry'} className={styles.tabButton}>Entry</button>
        <button onClick={() => setActiveTab('Vehicle Status')} disabled={activeTab === 'Vehicle Status'} className={styles.tabButton}>Vehicle Status</button>
        <button onClick={() => setActiveTab('Vehicle Exit')} disabled={activeTab === 'Vehicle Exit'} className={styles.tabButton}>
          Vehicle Exit
        </button>
      </div>
      <div className={styles.tabContent}>
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default VT01Page;
