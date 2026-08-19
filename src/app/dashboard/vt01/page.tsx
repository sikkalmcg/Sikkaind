'use client';

import { useState, useEffect, useMemo, FC, useCallback } from 'react';
import type { NextPage } from 'next';
import styles from '../../../../VT01.module.css';
import { useSearchParams } from 'next/navigation';
import { isValidMobileNumber, validateAndFormatVehicleNumber } from '../../../lib/validation';
import toast, { Toaster, Toast } from 'react-hot-toast';

// Custom Hooks for MongoDB Store Integration
import { useMongoStore, useUser, useMemoMongo, useCollectionOptimized } from '@/mongodb';
import { collection, doc, setDoc, updateDoc } from '@/lib/mongo-store'; 

interface PlantOption {
  plantCode: string;
  plantName: string;
}

const STATUS_OPTIONS = [
  "Loading",
  "Quality Check",
  "Documentation",
  "Waiting",
  "Gate Out",
  "Break-down",
  "Under Maintenance",
];

interface VehicleEntryData {
  plant: string;
  inDateTime: string;
  vehicleNo: string;
  driverName: string;
  driverMobile: string;
}

interface StatusHistoryRow {
  id: number | string;
  currentStatus: string;
  statusDateTime: string;
  toDateTime: string;
  remark: string;
  isNew?: boolean; 
}

interface VehicleRecord {
  id: string | number;
  plant: string;
  vehicleNo: string;
  driverName: string;
  driverMobile: string;
  inDateTime: string;
  currentStatus?: string;
  statusDateTime?: string;
  toDateTime?: string;
  exitDateTime?: string;
  remark?: string;
  statusHistory?: StatusHistoryRow[];
  historyId?: number;
}

const formatDateTimeForInput = (date: Date): string => {
  if (!date || isNaN(date.getTime())) return '';
  const pad = (num: number) => num.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const calculateDuration = (from: string, to: string): string => {
  if (!from) return '--:--';
  const fromDate = new Date(from);
  let toDate = to ? new Date(to) : new Date(); // Use current system time dynamically for open statuses

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || toDate < fromDate) {
    return '00:00';
  }

  const diffMs = toDate.getTime() - fromDate.getTime();
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours.toString().padStart(2, '0')} Hours ${minutes.toString().padStart(2, '0')} Minutes`;
};

const VT01Page: NextPage = () => {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'entry' | 'status' | 'exit' | 'non-plant'>('entry');

  const db = useMongoStore();
  const { user, isUserLoading: isAuthLoading } = useUser();

  // Top Filter Bar State
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // --- Data Fetching ---
  const vehicleMovementsQuery = useMemoMongo(
    () => collection(db, 'users', 'Sikkaind', 'vehicle_movements'),
    [db]
  );
  const { data, isLoading: isDataLoading } = useCollectionOptimized(vehicleMovementsQuery);
  const allVehicleMovements = data || [];
  
  // Core Data Lists with foolproof exit detection
  const plantRecords = useMemo(() => {
    return (allVehicleMovements || []).filter(rec => {
      const plantVal = rec.plant ? String(rec.plant).trim() : '';
      return plantVal !== '' && plantVal !== 'Outside';
    });
  }, [allVehicleMovements]);

  const statusRecords = useMemo(() => {
    return plantRecords.filter(rec => {
      const hasExit = !!rec.exitDateTime || !!(rec as any).outType || String((rec as any).status || '').toLowerCase() === 'exited';
      return !hasExit;
    });
  }, [plantRecords]);

  const exitRecords = useMemo(() => {
    return plantRecords.filter(rec => {
      const hasExit = !!rec.exitDateTime || !!(rec as any).outType || String((rec as any).status || '').toLowerCase() === 'exited';
      return hasExit;
    });
  }, [plantRecords]);

  const nonPlantRecords = useMemo(() => {
    return (allVehicleMovements || []).filter(rec => {
      const plantVal = rec.plant ? String(rec.plant).trim().toLowerCase() : '';
      return plantVal === 'outside';
    });
  }, [allVehicleMovements]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Vehicle Entry Form State
  const [entryData, setEntryData] = useState<VehicleEntryData>({
    plant: '',
    inDateTime: formatDateTimeForInput(new Date()),
    vehicleNo: '',
    driverName: '',
    driverMobile: '',
  });

  // Non-Plant Vehicle Form State
  const [nonPlantVehicleNo, setNonPlantVehicleNo] = useState('');
  const [nonPlantStation, setNonPlantStation] = useState('');
  const [nonPlantValidationError, setNonPlantValidationError] = useState('');
  const [isNonPlantSubmitting, setIsNonPlantSubmitting] = useState(false);
  const [createdNonPlantVehicle, setCreatedNonPlantVehicle] = useState<VehicleRecord | null>(null);

  // Non-Plant Status History
  const [nonPlantStatusHistory, setNonPlantStatusHistory] = useState<StatusHistoryRow[]>([]);

  const [validationErrors, setValidationErrors] = useState({
    vehicleNo: '',
    driverMobile: '',
  });

  // Status Update / Add Modal State
  const [selectedVehicleForStatus, setSelectedVehicleForStatus] = useState<VehicleRecord | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); // false = Add New Status, true = Update Open Status
  
  const [activeStatusForm, setActiveStatusForm] = useState({
    historyId: null as number | string | null,
    currentStatus: '',
    fromDateTime: formatDateTimeForInput(new Date()),
    toDateTime: '',
    remark: '',
    readOnlyPrevious: null as any,
  });

  // Exit Confirmation Modal State
  const [selectedVehicleForExit, setSelectedVehicleForExit] = useState<VehicleRecord | null>(null);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [exitDateTimeInput, setExitDateTimeInput] = useState(formatDateTimeForInput(new Date()));

  const [plantsList, setPlantsList] = useState<PlantOption[]>([]);
  const [plantsLoading, setPlantsLoading] = useState(true);

  // Fetch Plants
  useEffect(() => {
    if (isAuthLoading) return;
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

  // Set Default Plant
  useEffect(() => {
    if (plantsList.length > 0 && !selectedPlantFilter) {
      setSelectedPlantFilter(plantsList[0].plantCode);
      setEntryData(prev => ({ ...prev, plant: plantsList[0].plantCode }));
    }
  }, [plantsList]);

  // Handle Input Changes for Entry Form
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

  // Handle Non-Plant Vehicle Creation
  const handleCreateNonPlantVehicle = async () => {
    if (!nonPlantVehicleNo || !nonPlantStation) {
      toast.error('Vehicle Number and Station are mandatory.');
      return;
    }
    if (nonPlantValidationError) {
      toast.error('Please fix the validation error for Vehicle Number.');
      return;
    }

    setIsNonPlantSubmitting(true);
    const toastId = toast.loading('Creating Non-Plant Vehicle...');

    const vehicleData = {
      vehicleNo: nonPlantVehicleNo,
      station: nonPlantStation,
      plant: 'Outside',
      inDateTime: new Date().toISOString(),
      driverName: 'N/A',
      driverMobile: '0000000000',
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
      const newVehicle = { ...vehicleData, id: result.id, statusHistory: [] };
      setCreatedNonPlantVehicle(newVehicle);
      
      toast.success('Non-Plant Vehicle created. You can now add status updates.', { id: toastId });
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`, { id: toastId });
    } finally {
      setIsNonPlantSubmitting(false);
    }
  };

  const handleNonPlantStatusUpdate = async (rowToSave: StatusHistoryRow) => {
    if (!createdNonPlantVehicle) return;

    if (!rowToSave.currentStatus || !rowToSave.statusDateTime) {
        toast.error('Please provide at least Status and From Date Time.');
        return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Saving status update...');

    try {
        const vehicleDocRef = doc(db, 'users', 'Sikkaind', 'vehicle_movements', String(createdNonPlantVehicle.id));
        const existingHistory = createdNonPlantVehicle.statusHistory || [];
        const updatedHistory = rowToSave.isNew 
            ? [...existingHistory, { ...rowToSave, id: Date.now(), isNew: false }]
            : existingHistory.map(h => h.id === rowToSave.id ? rowToSave : h);

        const updatePayload = {
            currentStatus: rowToSave.currentStatus,
            statusDateTime: rowToSave.statusDateTime,
            toDateTime: rowToSave.toDateTime || '',
            remark: rowToSave.remark || '',
            statusHistory: updatedHistory,
            updatedAt: new Date().toISOString()
        };

        await updateDoc(vehicleDocRef, updatePayload);

        setCreatedNonPlantVehicle(prev => prev ? { ...prev, ...updatePayload } : null);
        toast.success(`Status saved successfully.`, { id: toastId });
    } catch (err) {
        toast.error(`Error: ${(err as Error).message}`, { id: toastId });
    } finally {
        setIsSubmitting(false);
    }
  };

  // Save Vehicle Entry (Vehicle IN action)
  const handleSaveEntry = async () => {
    if (!entryData.plant || !entryData.vehicleNo || !entryData.inDateTime) {
      toast.error('Please fill all mandatory fields: Plant, Vehicle Number, and IN Date Time.');
      return;
    }
    if (validationErrors.vehicleNo || validationErrors.driverMobile) {
      toast.error('Please fix validation errors before proceeding.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Processing Vehicle IN...');

    try {
      const vehicleData = {
        plant: entryData.plant,
        vehicleNo: entryData.vehicleNo,
        driverName: entryData.driverName || 'N/A',
        driverMobile: entryData.driverMobile || 'N/A',
        inDateTime: entryData.inDateTime,
        currentStatus: 'Vehicle IN',
        statusDateTime: entryData.inDateTime,
        toDateTime: '',
        statusHistory: []
      };

      const response = await fetch('/api/vehicles/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create vehicle entry.');
      }

      toast.success('Vehicle successfully checked IN and moved to Status tab!', { id: toastId });

      setEntryData({
        plant: selectedPlantFilter || '',
        inDateTime: formatDateTimeForInput(new Date()),
        vehicleNo: '',
        driverName: '',
        driverMobile: '',
      });
      setActiveTab('status');
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Status Update or Add Modal
  const openStatusModal = (vehicle: VehicleRecord, mode: 'update' | 'add', historyItem?: StatusHistoryRow | null) => {
    setSelectedVehicleForStatus(vehicle);
    const statusHistory = vehicle.statusHistory || [];

    if (mode === 'update') {
      setIsEditMode(true);
      setActiveStatusForm({
        historyId: historyItem?.id || vehicle.historyId || null,
        currentStatus: historyItem?.currentStatus || vehicle.currentStatus || '',
        fromDateTime: historyItem?.statusDateTime 
          ? formatDateTimeForInput(new Date(historyItem.statusDateTime)) 
          : formatDateTimeForInput(new Date(vehicle.statusDateTime || vehicle.inDateTime)),
        toDateTime: formatDateTimeForInput(new Date()), 
        remark: historyItem?.remark || vehicle.remark || '',
        readOnlyPrevious: null,
      });
    } else {
      setIsEditMode(false);
      const latestCompleted = [...statusHistory].sort((a, b) => new Date(b.toDateTime || 0).getTime() - new Date(a.toDateTime || 0).getTime())[0];
      const defaultFromTime = latestCompleted?.toDateTime 
        ? formatDateTimeForInput(new Date(latestCompleted.toDateTime)) 
        : (vehicle.toDateTime ? formatDateTimeForInput(new Date(vehicle.toDateTime)) : vehicle.inDateTime);

      setActiveStatusForm({
        historyId: null,
        currentStatus: '',
        fromDateTime: defaultFromTime,
        toDateTime: '',
        remark: '',
        readOnlyPrevious: latestCompleted || { currentStatus: vehicle.currentStatus || 'Vehicle IN', statusDateTime: vehicle.inDateTime, toDateTime: vehicle.toDateTime || '—' },
      });
    }
    setIsStatusModalOpen(true);
  };

  // DIRECT MONGODB STORE UPDATE
  const handlePostStatus = async () => {
    if (!activeStatusForm.currentStatus || !activeStatusForm.fromDateTime) {
      toast.error('Please fill at least Status and From Date Time.');
      return;
    }

    if (!selectedVehicleForStatus) return;

    setIsSubmitting(true);
    const toastId = toast.loading('Saving status update directly to database...');

    try {
      const vehicleId = String(selectedVehicleForStatus.id || (selectedVehicleForStatus as any)._id);
      const vehicleDocRef = doc(db, 'users', 'Sikkaind', 'vehicle_movements', vehicleId);
      
      const existingHistory = [...(selectedVehicleForStatus.statusHistory || [])];
      let updatedHistory = [...existingHistory];

      const finalRemark = activeStatusForm.remark?.trim() 
        ? activeStatusForm.remark.trim() 
        : `Status: ${activeStatusForm.currentStatus}`;

      const targetRowId = activeStatusForm.historyId || (existingHistory.length > 0 ? existingHistory[existingHistory.length - 1].id : Date.now());

      const newRow: StatusHistoryRow = {
        id: targetRowId,
        currentStatus: activeStatusForm.currentStatus,
        statusDateTime: activeStatusForm.fromDateTime,
        toDateTime: activeStatusForm.toDateTime || '',
        remark: finalRemark,
      };

      if (isEditMode && activeStatusForm.historyId) {
        updatedHistory = updatedHistory.map(h => String(h.id) === String(activeStatusForm.historyId) ? newRow : h);
      } else {
        if (updatedHistory.length === 0) {
          updatedHistory.push(newRow);
        } else {
          const lastIndex = updatedHistory.length - 1;
          if (!updatedHistory[lastIndex].toDateTime && isEditMode) {
            updatedHistory[lastIndex] = newRow;
          } else {
            updatedHistory.push(newRow);
          }
        }
      }

      const payload = {
        currentStatus: activeStatusForm.currentStatus,
        statusDateTime: activeStatusForm.fromDateTime,
        toDateTime: activeStatusForm.toDateTime || '', 
        remark: finalRemark,
        statusHistory: updatedHistory,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(vehicleDocRef, payload);

      toast.success('Status successfully updated in database!', { id: toastId });
      setIsStatusModalOpen(false);
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const promptVehicleExit = (vehicle: VehicleRecord) => {
    const hasOpenStatus = vehicle.statusHistory?.some(h => !h.toDateTime);
    if (vehicle.statusHistory?.length === 0 && (!vehicle.toDateTime || vehicle.toDateTime.trim() === '')) {
       // Allow exit
    } else if (hasOpenStatus && (!vehicle.toDateTime || vehicle.toDateTime.trim() === '')) {
      toast.error('Please complete all open statuses for this vehicle before exiting.');
      return;
    }
    
    setSelectedVehicleForExit(vehicle);
    setExitDateTimeInput(formatDateTimeForInput(new Date()));
    setIsExitModalOpen(true);
  };

  const confirmVehicleExit = async () => {
    if (!selectedVehicleForExit) return;

    setIsSubmitting(true);
    const toastId = toast.loading('Processing vehicle exit...');

    try {
      const vehicleId = String(selectedVehicleForExit.id || (selectedVehicleForExit as any)._id);
      const vehicleDocRef = doc(db, 'users', 'Sikkaind', 'vehicle_movements', vehicleId);

      const exitPayload = {
        exitDateTime: exitDateTimeInput,
        outType: 'Normal Exit',
        status: 'Exited',
        currentStatus: 'Exited',
        updatedAt: new Date().toISOString()
      };

      await updateDoc(vehicleDocRef, exitPayload);

      toast.success(`Vehicle ${selectedVehicleForExit.vehicleNo} successfully exited!`, { id: toastId });
      setIsExitModalOpen(false);
      setSelectedVehicleForExit(null);
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filterData = (list: any[]) => {
    return list.filter(item => {
      const matchesPlant = selectedPlantFilter ? item.plant === selectedPlantFilter : true;
      const matchesSearch = searchQuery
        ? [
            item.plant,
            item.vehicleNo,
            item.driverName,
            item.driverMobile,
            item.inDateTime,
            item.currentStatus,
            item.statusDateTime,
            item.toDateTime,
            item.exitDateTime,
            item.remark,
          ].some(val => val && String(val).toLowerCase().includes(searchQuery.toLowerCase()))
        : true;
      return matchesPlant && matchesSearch;
    });
  };

  const filteredStatusRecords = useMemo(() => filterData(statusRecords), [statusRecords, selectedPlantFilter, searchQuery]);
  const filteredExitRecords = useMemo(() => filterData(exitRecords), [exitRecords, selectedPlantFilter, searchQuery]);
  const filteredNonPlantRecords = useMemo(() => filterData(nonPlantRecords), [nonPlantRecords, selectedPlantFilter, searchQuery]);
    
  const getLatestStatusInfo = (vehicle: VehicleRecord) => {
    const statusHistory = vehicle.statusHistory || [];
    
    const rootToTime = vehicle.toDateTime || (vehicle as any).toTime || '';
    const rootStatus = vehicle.currentStatus || 'Vehicle IN';
    const rootFromTime = vehicle.statusDateTime || vehicle.inDateTime;

    if (statusHistory.length > 0) {
      const sortedHistory = [...statusHistory].sort((a, b) => {
        const timeA = new Date(a.statusDateTime || 0).getTime();
        const timeB = new Date(b.statusDateTime || 0).getTime();
        return timeB - timeA; 
      });
      
      const latestHistory = sortedHistory[0];
      const historyToTime = latestHistory.toDateTime || rootToTime;
      const hasHistoryToDate = !!historyToTime && String(historyToTime).trim() !== '' && String(historyToTime).trim() !== '—';

      return {
        latestHistory,
        currentStatusDisplay: latestHistory.currentStatus || rootStatus,
        statusFromDisplay: latestHistory.statusDateTime || rootFromTime,
        statusToDisplay: historyToTime,
        isLatestCompleted: hasHistoryToDate,
      };
    }

    const hasRootToDate = !!rootToTime && String(rootToTime).trim() !== '' && String(rootToTime).trim() !== '—';
    return {
      latestHistory: null,
      currentStatusDisplay: rootStatus,
      statusFromDisplay: rootFromTime,
      statusToDisplay: rootToTime,
      isLatestCompleted: rootStatus === 'Vehicle IN' || rootStatus === 'IN' ? true : hasRootToDate,
    };
  };

  return (
    <div className={styles.container}>
      <Toaster position="top-center" reverseOrder={false} />
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 className={styles.headerTitle}>VT01 – Vehicle Entry & Tracking</h1>
      </div> 

      {/* Top Filter Bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Plant Filter</label>
          <select 
            value={selectedPlantFilter} 
            onChange={(e) => setSelectedPlantFilter(e.target.value)} 
            className={styles.formInput}
          >
            <option value="">All Plants</option>
            {plantsList.map(p => (
              <option key={p.plantCode} value={p.plantCode}>{p.plantCode} - {p.plantName}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 2 }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Search Active Tab</label>
          <input 
            type="text" 
            placeholder="Search by text or digits..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.formInput}
          />
        </div>
      </div>

      {/* Active Tabs Navigation */}
      <div className={styles.tabs} style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
        <button 
          className={`${styles.tabButton} ${activeTab === 'entry' ? styles.activeTab : ''}`} 
          style={{ background: activeTab === 'entry' ? '#e2e8f0' : '#f1f5f9', fontWeight: activeTab === 'entry' ? 'bold' : 'normal', padding: '10px 20px', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
          onClick={() => setActiveTab('entry')}>
            1. Vehicle Entry
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'status' ? styles.activeTab : ''}`} 
          style={{ background: activeTab === 'status' ? '#e2e8f0' : '#f1f5f9', fontWeight: activeTab === 'status' ? 'bold' : 'normal', padding: '10px 20px', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
          onClick={() => setActiveTab('status')}>
            2. Status ({statusRecords.length})
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'exit' ? styles.activeTab : ''}`} 
          style={{ background: activeTab === 'exit' ? '#e2e8f0' : '#f1f5f9', fontWeight: activeTab === 'exit' ? 'bold' : 'normal', padding: '10px 20px', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
          onClick={() => setActiveTab('exit')}>
            3. Exit ({exitRecords.length})
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'non-plant' ? styles.activeTab : ''}`} 
          style={{ background: activeTab === 'non-plant' ? '#e2e8f0' : '#f1f5f9', fontWeight: activeTab === 'non-plant' ? 'bold' : 'normal', padding: '10px 20px', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
          onClick={() => setActiveTab('non-plant')}>
            4. Non-Plant Vehicle
        </button>
      </div>

      {/* Tab Content Panels */}
      <div className={styles.tabContent}>
        
        {/* TAB 1: VEHICLE ENTRY */}
        {activeTab === 'entry' && (
          <div className={styles.formContainer}>
            <h3 className={styles.header}>New Vehicle Entry Form</h3>
            <div className={styles.formGroup}>
              <label>Plant (Mandatory):</label>
              <select
                value={entryData.plant}
                onChange={(e) => handleEntryChange('plant', e.target.value)}
                className={styles.formInput}
              >
                <option value="">Select Plant...</option>
                {plantsList.map((p) => (
                  <option key={p.plantCode} value={p.plantCode}>{p.plantCode} - {p.plantName}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Vehicle Number (Mandatory):</label>
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
              <label>Driver Name (Optional):</label>
              <input
                type="text"
                value={entryData.driverName}
                onChange={(e) => handleEntryChange('driverName', e.target.value.toUpperCase())}
                placeholder="Enter Driver Name"
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Driver Mobile (Optional):</label>
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

            <div className={styles.formGroup}>
              <label>IN Date Time (Mandatory):</label>
              <input
                type="datetime-local"
                value={entryData.inDateTime}
                onChange={(e) => handleEntryChange('inDateTime', e.target.value)}
                className={styles.formInput}
              />
            </div>
            
            <div className={styles.formGroup} style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem' }}>
              <button type="button" onClick={handleSaveEntry} disabled={isSubmitting} className={styles.button}>
                {isSubmitting ? 'Processing...' : 'Vehicle IN'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: STATUS */}
        {activeTab === 'status' && (
          <div className={styles.tableContainer}>
            <h3 className={styles.header}>Active Yard Status</h3>
            <table className={styles.table} style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Plant</th>
                  <th>Vehicle Number</th>
                  <th>Driver Name</th>
                  <th>IN Date Time</th>
                  <th>Current Status</th>
                  <th>From Date Time</th>
                  <th>To Date Time</th>
                  <th>Duration</th>
                  <th>Action</th>
                  <th>Exit</th>
                </tr>
              </thead>
              <tbody>
                {isDataLoading && statusRecords.length === 0 ? ( 
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem' }}>Loading active vehicles...</td></tr>
                ) : filteredStatusRecords.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem' }}>No active vehicles in yard.</td></tr>
                ) : (
                  filteredStatusRecords.map((vehicle) => {
                    const { latestHistory, currentStatusDisplay, statusFromDisplay, statusToDisplay, isLatestCompleted } = getLatestStatusInfo(vehicle);

                    return (
                      <tr key={vehicle.id}>
                        <td>{vehicle.plant}</td>
                        <td><strong>{vehicle.vehicleNo}</strong></td>
                        <td>{vehicle.driverName}</td>
                        <td>{vehicle.inDateTime?.replace('T', ' ') || '--'}</td>
                        <td><span style={{ padding: '4px 8px', background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', fontSize: '12px' }}>{currentStatusDisplay}</span></td>
                        <td>{statusFromDisplay?.replace('T', ' ') || '--'}</td>
                        <td>{statusToDisplay ? statusToDisplay.replace('T', ' ') : '— (Open)'}</td>
                        <td>{calculateDuration(statusFromDisplay || '', statusToDisplay || '')}</td>
                        <td>
                          {isLatestCompleted ? ( 
                             <button type="button" onClick={() => openStatusModal(vehicle, 'add')} disabled={isSubmitting} className={`${styles.button} ${styles.actionButton}`} style={{backgroundColor: '#16a34a', minWidth: '85px'}}>
                              Add
                             </button>
                          ) : ( 
                            <button type="button" onClick={() => openStatusModal(vehicle, 'update', latestHistory)} disabled={isSubmitting || !!vehicle.exitDateTime} className={`${styles.button} ${styles.actionButton}`} style={{backgroundColor: '#2563eb', minWidth: '85px'}}>
                              Update
                            </button>
                          )}
                        </td>
                        <td>
                          <button type="button" onClick={() => promptVehicleExit(vehicle)} disabled={isSubmitting} className={`${styles.button} ${styles.deleteButton}`} style={{ backgroundColor: '#dc2626' }}>
                            Exit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: EXIT */}
        {activeTab === 'exit' && (
          <div className={styles.tableContainer}>
            <h3 className={styles.header}>Exited Vehicle Records (Full History Retained)</h3>
            <table className={styles.table} style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Plant</th>
                  <th>Vehicle Number</th>
                  <th>IN Date Time</th>
                  <th>Status History Details</th>
                  <th>Exit Date Time</th>
                  <th>Total Duration</th>
                </tr>
              </thead>
              <tbody>
                {filteredExitRecords.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No exited vehicles found.</td></tr>
                ) : (
                  filteredExitRecords.map((veh, index) => (
                    <tr key={veh.id || index}>
                      <td>{veh.plant}</td>
                      <td><strong>{veh.vehicleNo}</strong></td>
                      <td>{veh.inDateTime?.replace('T', ' ') || '--'}</td>
                      <td>
                        <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '12px' }}>
                          <li><strong>Vehicle IN</strong>: {veh.inDateTime?.replace('T', ' ')}</li>
                          {veh.statusHistory?.map((h: StatusHistoryRow, i: number) => (
                            <li key={i}>
                              {h.currentStatus} ({h.statusDateTime?.replace('T', ' ')} → {h.toDateTime ? h.toDateTime.replace('T', ' ') : 'Open'})
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>{veh.exitDateTime ? veh.exitDateTime.replace('T', ' ') : ((veh as any).exitTime ? (veh as any).exitTime.replace('T', ' ') : '--')}</td>
                      <td><strong>{calculateDuration(veh.inDateTime, veh.exitDateTime || (veh as any).exitTime || '')}</strong></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: NON-PLANT VEHICLE */}
        {activeTab === 'non-plant' && (
          <div>
            <div className={styles.formContainer}>
              <h3 className={styles.header}>Create Non-Plant Vehicle</h3>
              <div className={styles.formGroup}>
                <label>Vehicle Number (Mandatory):</label>
                <input
                  type="text"
                  value={nonPlantVehicleNo}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    setNonPlantVehicleNo(value);
                    if (!validateAndFormatVehicleNumber(value) && value) {
                      setNonPlantValidationError('Please enter a valid Vehicle Number.');
                    } else {
                      setNonPlantValidationError('');
                    }
                  }}
                  placeholder="E.G. UP14GT0600"
                  className={styles.formInput}
                  disabled={!!createdNonPlantVehicle}
                />
                {nonPlantValidationError && <p className={styles.errorText}>{nonPlantValidationError}</p>}
              </div>

              <div className={styles.formGroup}>
                <label>Station (Mandatory):</label>
                <input
                  type="text"
                  value={nonPlantStation}
                  onChange={(e) => setNonPlantStation(e.target.value)}
                  placeholder="Enter Station Name"
                  className={styles.formInput}
                  disabled={!!createdNonPlantVehicle}
                />
              </div>

              <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                <button
                  type="button"
                  onClick={handleCreateNonPlantVehicle}
                  disabled={isNonPlantSubmitting || !!createdNonPlantVehicle}
                  className={styles.button}
                >
                  {isNonPlantSubmitting ? 'Creating...' : 'Create Vehicle'}
                </button>
              </div>
            </div>

            {createdNonPlantVehicle && (
              <div className={styles.tableContainer} style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 className={styles.header}>Status History for {createdNonPlantVehicle.vehicleNo}</h3>
                    <button 
                        onClick={() => {
                            const lastStatus = createdNonPlantVehicle.statusHistory?.[createdNonPlantVehicle.statusHistory.length - 1];
                            if (lastStatus && !lastStatus.toDateTime) {
                                toast.error('Complete the previous status before adding a new one.');
                                return;
                            }
                            const newRow: StatusHistoryRow = {
                                id: Date.now(),
                                currentStatus: '',
                                statusDateTime: lastStatus?.toDateTime ? formatDateTimeForInput(new Date(lastStatus.toDateTime)) : createdNonPlantVehicle.inDateTime,
                                toDateTime: '',
                                remark: '',
                                isNew: true,
                            };
                            setCreatedNonPlantVehicle(prev => prev ? ({ ...prev, statusHistory: [...(prev.statusHistory || []), newRow] }) : null);
                        }}
                        className={styles.button}
                    >
                        Add Status Row
                    </button>
                </div>
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
                    {(createdNonPlantVehicle.statusHistory || []).map((row, index) => (
                      <tr key={row.id}>
                        <td>
                          <select
                            value={row.currentStatus}
                            onChange={(e) => {
                                const newHistory = [...(createdNonPlantVehicle.statusHistory || [])];
                                newHistory[index].currentStatus = e.target.value;
                                setCreatedNonPlantVehicle(prev => prev ? { ...prev, statusHistory: newHistory } : null);
                            }}
                            className={styles.formInput}
                          >
                            <option value="">Select Status</option>
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td>
                          <input
                            type="datetime-local"
                            value={formatDateTimeForInput(new Date(row.statusDateTime))}
                            onChange={(e) => {
                                const newHistory = [...(createdNonPlantVehicle.statusHistory || [])];
                                newHistory[index].statusDateTime = e.target.value;
                                setCreatedNonPlantVehicle(prev => prev ? { ...prev, statusHistory: newHistory } : null);
                            }}
                            className={styles.formInput}
                          />
                        </td>
                        <td>
                          <input
                            type="datetime-local"
                            value={row.toDateTime ? formatDateTimeForInput(new Date(row.toDateTime)) : ''}
                            onChange={(e) => {
                                const newHistory = [...(createdNonPlantVehicle.statusHistory || [])];
                                newHistory[index].toDateTime = e.target.value;
                                setCreatedNonPlantVehicle(prev => prev ? { ...prev, statusHistory: newHistory } : null);
                            }}
                            className={styles.formInput}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={row.remark}
                            onChange={(e) => {
                                const newHistory = [...(createdNonPlantVehicle.statusHistory || [])];
                                newHistory[index].remark = e.target.value;
                                setCreatedNonPlantVehicle(prev => prev ? { ...prev, statusHistory: newHistory } : null);
                            }}
                            className={styles.formInput}
                          />
                        </td>
                        <td>
                          <button onClick={() => handleNonPlantStatusUpdate(row)} disabled={isSubmitting} className={`${styles.button} ${styles.actionButton}`}>Save</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* STATUS UPDATE / ADD POPUP MODAL */}
      {isStatusModalOpen && selectedVehicleForStatus && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', width: '600px', maxWidth: '90%' }}>
            <h3 className={styles.header} style={{ marginBottom: '1rem' }}>
              {isEditMode ? 'Update Open Status (Add To Date Time)' : 'Add New Status'}
            </h3>
            
            {/* Reference Header for Add Mode */}
            {!isEditMode && activeStatusForm.readOnlyPrevious && (
              <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '6px', marginBottom: '1rem', fontSize: '13px', border: '1px solid #cbd5e1' }}>
                <p><strong>Previous Status Reference:</strong> {activeStatusForm.readOnlyPrevious.currentStatus}</p>
                <p><strong>From:</strong> {activeStatusForm.readOnlyPrevious.statusDateTime?.replace('T', ' ')} | <strong>To:</strong> {activeStatusForm.readOnlyPrevious.toDateTime && activeStatusForm.readOnlyPrevious.toDateTime !== '—' ? activeStatusForm.readOnlyPrevious.toDateTime.replace('T', ' ') : '—'}</p>
              </div>
            )}

            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', marginBottom: '1rem', fontSize: '13px' }}>
              <p><strong>Vehicle:</strong> {selectedVehicleForStatus.vehicleNo} | <strong>Driver:</strong> {selectedVehicleForStatus.driverName}</p>
              <p><strong>Vehicle IN Time:</strong> {selectedVehicleForStatus.inDateTime?.replace('T', ' ') || '--'}</p>
            </div>

            <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
              <label>Status Dropdown:</label>
              <select
                value={activeStatusForm.currentStatus}
                onChange={(e) => setActiveStatusForm(prev => ({ ...prev, currentStatus: e.target.value }))}
                className={styles.formInput}
              >
                <option value="">Select Status...</option>
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
              <label>From Date Time (Mandatory):</label>
              <input
                type="datetime-local"
                value={activeStatusForm.fromDateTime}
                onChange={(e) => setActiveStatusForm(prev => ({ ...prev, fromDateTime: e.target.value }))}
                className={styles.formInput}
                readOnly={isEditMode} 
              />
            </div>

            <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
              <label>To Date Time (Optional - leave blank for open status):</label>
              <input
                type="datetime-local"
                value={activeStatusForm.toDateTime}
                onChange={(e) => setActiveStatusForm(prev => ({ ...prev, toDateTime: e.target.value }))}
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup} style={{ marginBottom: '1.5rem' }}>
              <label>Remark:</label>
              <textarea
                value={activeStatusForm.remark}
                onChange={(e) => setActiveStatusForm(prev => ({ ...prev, remark: e.target.value }))}
                maxLength={1000}
                className={styles.formInput}
                placeholder="Add remarks here..."
                rows={3}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setIsStatusModalOpen(false)} className={`${styles.button} ${styles.deleteButton}`}>
                Cancel
              </button>
              <button type="button" onClick={handlePostStatus} disabled={isSubmitting} className={styles.button} style={{ backgroundColor: '#2563eb' }}>
                Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXIT CONFIRMATION MODAL */}
      {isExitModalOpen && selectedVehicleForExit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', width: '450px', maxWidth: '90%' }}>
            <h3 className={styles.header} style={{ color: '#dc2626', marginBottom: '1rem' }}>Confirm Vehicle Exit</h3>
            <p style={{ marginBottom: '1rem', fontSize: '14px' }}>
              Are you sure you want to exit vehicle <strong>{selectedVehicleForExit.vehicleNo}</strong>? All historical statuses will be moved to Exit.
            </p>

            <div className={styles.formGroup} style={{ marginBottom: '1.5rem' }}>
              <label>Exit Date Time:</label>
              <input
                type="datetime-local"
                value={exitDateTimeInput}
                onChange={(e) => setExitDateTimeInput(e.target.value)}
                className={styles.formInput}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setIsExitModalOpen(false)} className={`${styles.button} ${styles.deleteButton}`}>
                Cancel
              </button>
              <button type="button" onClick={confirmVehicleExit} disabled={isSubmitting} className={styles.button} style={{ backgroundColor: '#dc2626' }}>
                Confirm Exit
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default VT01Page;