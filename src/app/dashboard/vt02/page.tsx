'use client';
import type { NextPage } from 'next';
import { useState, useEffect, useMemo } from 'react';
import styles from '../../../../VT01.module.css';
import { useSearchParams } from 'next/navigation';
import { useMongoStore, useCollectionOptimized, useMemoMongo, deleteDocumentNonBlocking } from '@/mongodb';
import { collection, doc } from '@/lib/mongo-store';

const SHARED_HUB_ID = 'Sikkaind';

interface PlantOption {
  id: string;
  plantCode: string;
  plantName: string;
  status: string;
}

const VT02Page: NextPage = () => {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'Vehicle Entry' | 'Vehicle Status' | 'Vehicle Exit'>('Vehicle Entry');
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [plantFilter, setPlantFilter] = useState('');
  const db = useMongoStore();

  const vehicleMovementsQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'vehicle_movements'),
    [db],
  );
  const { data: vehicleMovements } = useCollectionOptimized(vehicleMovementsQuery);
  const vehicleData = useMemo(() => {
    const rows = vehicleMovements || [];
    return {
      entry: rows.filter((row: any) => !row.currentStatus && !row.outDateTime),
      status: rows.filter((row: any) => !!row.currentStatus && !row.outDateTime),
      exit: rows.filter((row: any) => !!row.outDateTime),
    };
  }, [vehicleMovements]);

  // OX03 Plant Master is the single source for plant selections in VT01/02/03.
  useEffect(() => {
    const fetchPlants = async () => {
      try {
        const response = await fetch('/api/plants');
        if (!response.ok) throw new Error('Unable to fetch Plant Master data.');

        const data: PlantOption[] = await response.json();
        setPlants(data.filter((plant) => plant.status === 'Active'));
      } catch (error) {
        console.error('Failed to fetch plants:', error);
      }
    };

    fetchPlants();
  }, []);

  const tcode = useMemo(() => searchParams.get('tcode'), [searchParams]);
  const pageTitle = useMemo(() => {
    return tcode === 'VT02' ? 'VT02 - Vehicle Entry / Edit' : 'VT01 - Vehicle Entry / Create';
  }, [tcode]);

  const handleEdit = (id: string, tab: keyof typeof vehicleData) => {
    // In a real app, this would likely navigate to a dedicated edit page or open a modal.
    alert(`Editing record ID: ${id} from ${tab}`);
  };

  const handleDelete = (id: string, tab: keyof typeof vehicleData) => {
    if (window.confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'vehicle_movements', id));
      alert(`Record ID: ${id} from ${tab} has been deleted.`);
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'Vehicle Entry':
        return (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Plant</th><th>Vehicle Number</th><th>Driver Name</th><th>Driver Mobile</th><th>In Date Time</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {vehicleData.entry.filter((row) => !plantFilter || row.plant === plantFilter).map((row) => (
                <tr key={row.id}>
                  <td>{row.plant}</td>
                  <td>{row.vehicleNo}</td>
                  <td>{row.driverName}</td>
                  <td>{row.driverMobile}</td>
                  <td>{new Date(row.inDateTime).toLocaleString()}</td>
                  <td>
                    <button onClick={() => handleEdit(row.id, 'entry')} className={`${styles.button} ${styles.editButton}`}>Edit</button>
                    <button onClick={() => handleDelete(row.id, 'entry')} className={`${styles.button} ${styles.deleteButton}`}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'Vehicle Status':
        return (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Plant</th><th>Vehicle Number</th><th>Driver Name</th><th>Driver Mobile</th><th>In Date Time</th>
                <th>Current Status</th><th>Status Time</th><th>Customer</th><th>Destination</th><th>Remark</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {vehicleData.status.filter((row) => !plantFilter || row.plant === plantFilter).map((row) => (
                <tr key={row.id}>
                  <td>{row.plant}</td>
                  <td>{row.vehicleNo}</td>
                  <td>{row.driverName}</td>
                  <td>{row.driverMobile}</td>
                  <td>{new Date(row.inDateTime).toLocaleString()}</td>
                  <td>{row.currentStatus}</td>
                  <td>{new Date(row.statusTime).toLocaleString()}</td>
                  <td>{row.customer}</td>
                  <td>{row.destination}</td>
                  <td>{row.remark}</td>
                  <td>
                    <button onClick={() => handleEdit(row.id, 'status')} className={`${styles.button} ${styles.editButton}`}>Edit</button>
                    <button onClick={() => handleDelete(row.id, 'status')} className={`${styles.button} ${styles.deleteButton}`}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'Vehicle Exit':
        return (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Plant</th><th>Vehicle Number</th><th>Driver Name</th><th>Driver Mobile</th><th>In Date Time</th>
                <th>Current Status</th><th>Status Time</th><th>Customer</th><th>Destination</th><th>Remark</th><th>Out Date Time</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {vehicleData.exit.filter((row) => !plantFilter || row.plant === plantFilter).map((row) => (
                <tr key={row.id}>
                  <td>{row.plant}</td>
                  <td>{row.vehicleNo}</td>
                  <td>{row.driverName}</td>
                  <td>{row.driverMobile}</td>
                  <td>{new Date(row.inDateTime).toLocaleString()}</td>
                  <td>{row.currentStatus}</td>
                  <td>{new Date(row.statusTime).toLocaleString()}</td>
                  <td>{row.customer}</td>
                  <td>{row.destination}</td>
                  <td>{row.remark}</td>
                  <td>{new Date(row.outDateTime).toLocaleString()}</td>
                  <td>
                    <button onClick={() => handleEdit(row.id, 'exit')} className={`${styles.button} ${styles.editButton}`}>Edit</button>
                    <button onClick={() => handleDelete(row.id, 'exit')} className={`${styles.button} ${styles.deleteButton}`}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.headerTitle}>{pageTitle}</h1>
      <div className={styles.formGroup}>
        <label htmlFor="plant-filter">Plant:</label>
        <select
          id="plant-filter"
          value={plantFilter}
          onChange={(event) => setPlantFilter(event.target.value)}
          className={styles.formInput}
        >
          <option value="">All Plants</option>
          {plants.map((plant) => (
            <option key={plant.id} value={plant.plantCode}>
              {plant.plantCode} - {plant.plantName}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.tabContainer}>
        <button onClick={() => setActiveTab('Vehicle Entry')} disabled={activeTab === 'Vehicle Entry'} className={styles.tabButton}>
          Vehicle Entry
        </button>
        <button onClick={() => setActiveTab('Vehicle Status')} disabled={activeTab === 'Vehicle Status'} className={styles.tabButton}>
          Vehicle Status
        </button>
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

export default VT02Page;
