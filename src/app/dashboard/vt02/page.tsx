'use client';
import type { NextPage } from 'next';
import { useState, useEffect, useMemo, FC } from 'react';
import styles from '../../../../VT01.module.css';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMongoStore, useCollectionOptimized, useMemoMongo, deleteDocumentNonBlocking, updateDocumentNonBlocking, useUser } from '@/mongodb';
import { collection, doc } from '@/lib/mongo-store';
import toast, { Toaster } from 'react-hot-toast';

const SHARED_HUB_ID = 'Sikkaind';

interface PlantOption {
  id: string;
  plantCode: string;
  plantName: string;
  status: string;
}

interface EditPopupProps {
  row: any;
  onClose: () => void;
  onSave: (updatedData: any) => void;
  tab: 'Vehicle Entry' | 'Vehicle Status' | 'Vehicle Exit' | 'Non-Plant Vehicle';
}

const VT02Page: NextPage = () => {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'Vehicle Entry' | 'Vehicle Status' | 'Vehicle Exit' | 'Non-Plant Vehicle'>('Vehicle Entry');
  const router = useRouter();
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [plantFilter, setPlantFilter] = useState('');
  const [editingRow, setEditingRow] = useState<any | null>(null);

  const db = useMongoStore();
  const { user } = useUser();

  const vehicleMovementsQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'vehicle_movements'),
    [db],
  );
  const { data: vehicleMovements } = useCollectionOptimized(vehicleMovementsQuery);

  const usersMasterQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'users_master'),
    [db],
  );
  const { data: allUsers } = useCollectionOptimized(usersMasterQuery);

  const vehicleData = useMemo(() => {
    if (!vehicleMovements || !allUsers) return { entry: [], status: [], exit: [], nonPlant: [] };

    const userMap = new Map(allUsers.map(u => [u.email, u.name]));
    const getUserName = (email: string) => userMap.get(email) || email;

    const rows = vehicleMovements.map(row => ({ ...row, updatedBy: getUserName(row.updatedBy) })) || [];

    return {
      entry: rows.filter((row: any) => row.plant !== 'Outside' && (row.currentStatus === 'IN' || !row.currentStatus) && !row.outDateTime),
      status: rows.filter((row: any) => row.plant !== 'Outside' && !!row.currentStatus && row.currentStatus !== 'IN' && !row.outDateTime),
      exit: rows.filter((row: any) => row.plant !== 'Outside' && !!row.outDateTime),
      nonPlant: rows.filter((row: any) => row.plant === 'Outside'),
    };
  }, [vehicleMovements, allUsers]);

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
    router.push(`/dashboard/vt01?id=${id}`);
  };

  const handleSave = (updatedData: any) => {
    if (!editingRow) return;
    const { id, ...dataToSave } = updatedData;
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'vehicle_movements', editingRow.id), {
      ...dataToSave,
      updatedBy: user?.email, // Save email on edit
      updatedAt: new Date().toISOString(),
    });
    toast.success('Record updated successfully!');
    setEditingRow(null);
  };

  const handleDelete = (id: string, tab: keyof typeof vehicleData) => {
    if (window.confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'vehicle_movements', id));
      toast.success(`Record ID: ${id} from ${tab} has been deleted.`);
    }
  };

  const EditPopup: FC<EditPopupProps> = ({ row, onClose, onSave, tab }) => {
    const [data, setData] = useState(row);

    const handleChange = (field: string, value: any) => {
      setData((prev: any) => ({ ...prev, [field]: value }));
    };

    return (
      <div className={styles.popup}>
        <div className={styles.popupContent}>
          <h3>Edit Record</h3>
          <div className={styles.formContainer} style={{padding: '1rem 0'}}>
            { (tab === 'Vehicle Entry' || tab === 'Vehicle Status' || tab === 'Vehicle Exit') &&
              <div className={styles.formGroup}><label>Plant</label><input type="text" value={data.plant} onChange={(e) => handleChange('plant', e.target.value)} className={styles.formInput} /></div>
            }
            <div className={styles.formGroup}><label>Vehicle Number</label><input type="text" value={data.vehicleNo} onChange={(e) => handleChange('vehicleNo', e.target.value)} className={styles.formInput} /></div>
            { (tab === 'Vehicle Entry' || tab === 'Vehicle Status' || tab === 'Vehicle Exit') &&
              <>
                <div className={styles.formGroup}><label>Driver Name</label><input type="text" value={data.driverName} onChange={(e) => handleChange('driverName', e.target.value)} className={styles.formInput} /></div>
                <div className={styles.formGroup}><label>Driver Mobile</label><input type="text" value={data.driverMobile} onChange={(e) => handleChange('driverMobile', e.target.value)} className={styles.formInput} /></div>
                <div className={styles.formGroup}><label>In Date Time</label><input type="datetime-local" value={data.inDateTime ? new Date(data.inDateTime).toISOString().slice(0,16) : ''} onChange={(e) => handleChange('inDateTime', e.target.value)} className={styles.formInput} /></div>
              </>
            }
            { tab === 'Vehicle Status' &&
              <>
                <div className={styles.formGroup}><label>Current Status</label><input type="text" value={data.currentStatus} onChange={(e) => handleChange('currentStatus', e.target.value)} className={styles.formInput} /></div>
                <div className={styles.formGroup}><label>Status Time</label><input type="datetime-local" value={data.statusDateTime ? new Date(data.statusDateTime).toISOString().slice(0,16) : ''} onChange={(e) => handleChange('statusDateTime', e.target.value)} className={styles.formInput} /></div>
                <div className={styles.formGroup}><label>Customer</label><input type="text" value={data.customer} onChange={(e) => handleChange('customer', e.target.value)} className={styles.formInput} /></div>
                <div className={styles.formGroup}><label>Ship to Party</label><input type="text" value={data.shipToParty} onChange={(e) => handleChange('shipToParty', e.target.value)} className={styles.formInput} /></div>
              </>
            }
            { tab === 'Vehicle Exit' &&
              <>
                <div className={styles.formGroup}><label>Out Type</label>
                  <select value={data.outType} onChange={(e) => handleChange('outType', e.target.value)} className={styles.formInput}>
                    <option value="Empty Vehicle">Empty Vehicle</option>
                    <option value="Load Vehicle">Load Vehicle</option>
                  </select>
                </div>
                <div className={styles.formGroup}><label>Out Date Time</label><input type="datetime-local" value={data.outDateTime ? new Date(data.outDateTime).toISOString().slice(0,16) : ''} onChange={(e) => handleChange('outDateTime', e.target.value)} className={styles.formInput} /></div>
              </>
            }
            { tab === 'Non-Plant Vehicle' &&
              <>
                <div className={styles.formGroup}><label>Station</label><input type="text" value={data.station} onChange={(e) => handleChange('station', e.target.value)} className={styles.formInput} /></div>
                <div className={styles.formGroup}><label>Current Status</label><input type="text" value={data.currentStatus} onChange={(e) => handleChange('currentStatus', e.target.value)} className={styles.formInput} /></div>
                <div className={styles.formGroup}><label>Last Status Time</label><input type="datetime-local" value={data.statusDateTime ? new Date(data.statusDateTime).toISOString().slice(0,16) : ''} onChange={(e) => handleChange('statusDateTime', e.target.value)} className={styles.formInput} /></div>
              </>
            }
          </div>
          <div className={styles.buttonGroup}>
            <button onClick={() => onSave(data)} className={styles.button}>Post</button>
            <button onClick={onClose} className={styles.buttonSecondary}>Cancel</button>
          </div>
        </div>
      </div>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'Vehicle Entry':
        return (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Plant</th><th>Vehicle Number</th><th>Driver Name</th><th>Driver Mobile</th><th>In Date Time</th><th>Updated By</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {vehicleData.entry.filter((row) => !plantFilter || row.plant?.startsWith(plantFilter)).map((row) => (
                <tr key={row.id}>
                  <td>{row.plant}</td>
                  <td>{row.vehicleNo}</td>
                  <td>{row.driverName}</td>
                  <td>{row.driverMobile}</td>
                  <td>{new Date(row.inDateTime).toLocaleString()}</td>
                  <td>{row.updatedBy || '-'}</td>
                  <td>
                    <button onClick={() => setEditingRow(row)} className={`${styles.button} ${styles.editButton}`}>Edit</button>
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
                <th>Current Status</th><th>Status Time</th><th>Customer</th><th>Ship to Party</th><th>Updated By</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {vehicleData.status.filter((row) => !plantFilter || row.plant?.startsWith(plantFilter)).map((row) => (
                <tr key={row.id}>
                  <td>{row.plant}</td>
                  <td>{row.vehicleNo}</td>
                  <td>{row.driverName}</td>
                  <td>{row.driverMobile}</td>
                  <td>{new Date(row.inDateTime).toLocaleString()}</td>
                  <td>{row.currentStatus}</td>
                  <td>{row.statusDateTime ? new Date(row.statusDateTime).toLocaleString() : '-'}</td>
                  <td>{row.customer}</td>
                  <td>{row.shipToParty}</td>
                  <td>{row.updatedBy || '-'}</td>
                  <td>
                    <button onClick={() => setEditingRow(row)} className={`${styles.button} ${styles.editButton}`}>Edit</button>
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
                <th>Plant</th><th>Vehicle Number</th><th>Driver Name</th><th>Driver Mobile</th><th>In Date Time</th><th>Out Type</th><th>Out Date Time</th><th>Updated By</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {vehicleData.exit.filter((row) => !plantFilter || row.plant?.startsWith(plantFilter)).map((row) => (
                <tr key={row.id}>
                  <td>{row.plant}</td>
                  <td>{row.vehicleNo}</td>
                  <td>{row.driverName}</td>
                  <td>{row.driverMobile}</td>
                  <td>{new Date(row.inDateTime).toLocaleString()}</td>
                  <td>{row.outType}</td>
                  <td>{new Date(row.outDateTime).toLocaleString()}</td>
                  <td>{row.updatedBy || '-'}</td>
                  <td>
                    <button onClick={() => setEditingRow(row)} className={`${styles.button} ${styles.editButton}`}>Edit</button>
                    <button onClick={() => handleDelete(row.id, 'exit')} className={`${styles.button} ${styles.deleteButton}`}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'Non-Plant Vehicle':
        return (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Vehicle Number</th>
                  <th>Station</th>
                  <th>Current Status</th>
                  <th>Last Status Time</th><th>Updated By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {vehicleData.nonPlant.map((row) => (
                  <tr key={row.id}>
                    <td>{row.vehicleNo}</td>
                    <td>{row.station}</td>
                    <td>{row.currentStatus}</td>
                    <td>{row.statusDateTime ? new Date(row.statusDateTime).toLocaleString() : new Date(row.inDateTime).toLocaleString()}</td>
                    <td>{row.updatedBy || '-'}</td>
                    <td>
                      <button onClick={() => setEditingRow(row)} className={`${styles.button} ${styles.editButton}`}>Edit</button>
                      <button onClick={() => handleDelete(row.id, 'nonPlant')} className={`${styles.button} ${styles.deleteButton}`}>Delete</button>
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
      <Toaster position="top-center" reverseOrder={false} />
      <h1 className={styles.headerTitle}>{pageTitle}</h1>
      {activeTab !== 'Non-Plant Vehicle' && (
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
      )}
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
        <button onClick={() => setActiveTab('Non-Plant Vehicle')} disabled={activeTab === 'Non-Plant Vehicle'} className={styles.tabButton}>
          Non-Plant Vehicle
        </button>
      </div>
      <div className={styles.tabContent}>
        {renderActiveTab()}
      </div>
      {editingRow && (
        <EditPopup row={editingRow} onClose={() => setEditingRow(null)} onSave={handleSave} tab={activeTab} />
      )}
    </div>
  );
};

export default VT02Page;
