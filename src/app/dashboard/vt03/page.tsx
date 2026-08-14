'use client';
import type { NextPage } from 'next';
import { useState, useMemo, useEffect, Suspense } from 'react';
import styles from '../../../../VT01.module.css';
import { utils, writeFile } from 'xlsx';
import { useSearchParams } from 'next/navigation'; // Import useSearchParams
import { useUser, useMongoStore, useDoc, useMemoMongo, useCollectionOptimized } from '@/mongodb';
import { collection, doc, where, query } from '@/lib/mongo-store';
import { differenceInHours } from 'date-fns';

const SHARED_HUB_ID = 'Sikkaind';

const calculateStayHours = (inTime: any, outTime: any) => {
  if (!inTime) return '-';
  const start = new Date(inTime.seconds ? inTime.seconds * 1000 : inTime);
  const end = outTime ? new Date(outTime.seconds ? outTime.seconds * 1000 : outTime) : new Date();
  return differenceInHours(end, start);
};

const formatDateTime = (value: any) => {
  if (!value) return '-';
  const date = new Date(value.seconds ? value.seconds * 1000 : value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

const VT03Content: NextPage = () => {
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [plantFilter, setPlantFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // e.g., 'Load Stay', 'Empty Stay'
  const [inOutFilter, setInOutFilter] = useState(''); // 'IN' or 'OUT'
  const [dateFilter, setDateFilter] = useState('');

  // Plant fetching logic
  const { user } = useUser();
  const db = useMongoStore();
  const [isBootstrapAdmin, setIsBootstrapAdmin] = useState(false);
  const [registryId, setRegistryId] = useState<string | null>(null);

  useEffect(() => {
    setIsBootstrapAdmin(localStorage.getItem('sap_bootstrap_session') === 'true');
    setRegistryId(localStorage.getItem('sap_registry_id'));
  }, []);

  const profileRef = useMemoMongo(() => {
    if (!registryId || isBootstrapAdmin) return null;
    return doc(db, 'users', 'Sikkaind', 'users_master', registryId);
  }, [db, registryId, isBootstrapAdmin]);

  const { data: userProfile } = useDoc(profileRef);

  const plantsQuery = useMemoMongo(() => collection(db, 'users', 'Sikkaind', 'plants'), [db]);
  const { data: allPlants } = useCollectionOptimized(plantsQuery);

  const authorizedPlants = useMemo(() => {
    if (isBootstrapAdmin) return allPlants || [];
    const codes = userProfile?.plantAccess || [];
    return (allPlants || []).filter(p => codes.includes(p.plantCode));
  }, [allPlants, userProfile, isBootstrapAdmin]);

  const vehicleMovementsQuery = useMemoMongo(() => {
    return collection(db, 'users', SHARED_HUB_ID, 'vehicle_movements');
  }, [db]);

  const { data: vehicleData, isLoading } = useCollectionOptimized(vehicleMovementsQuery);

  const uniqueStatuses = useMemo(() => {
    if (!vehicleData) return [];
    return [...new Set(vehicleData.map(item => item.currentStatus).filter(Boolean))];
  }, [vehicleData]);

  const tcode = useMemo(() => searchParams.get('tcode'), [searchParams]);
  const pageTitle = useMemo(() => {
    return tcode === 'VT03' ? 'VT03 - Vehicle Entry / Display' : 'Vehicle Entry / Display';
  }, [tcode]);


  const filteredData = useMemo(() => {
    if (!vehicleData) return [];
    return vehicleData.filter(record => {
      const q = searchQuery.toLowerCase();
      const searchMatch = !q ||
        record.vehicleNo?.toLowerCase().includes(q) ||
        record.driverName?.toLowerCase().includes(q) ||
        record.customer?.toLowerCase().includes(q);
      
      const plantMatch = !plantFilter || 
        (plantFilter === 'Outside' 
          ? record.plant === 'Outside' 
          : record.plant?.startsWith(plantFilter)
        );

      const statusMatch = !statusFilter || record.currentStatus === statusFilter;
      const inOutMatch = !inOutFilter || (inOutFilter === 'IN' && !record.outDateTime) || (inOutFilter === 'OUT' && !!record.outDateTime);
      
      const dateMatch = !dateFilter || (record.inDateTime && new Date(record.inDateTime.seconds ? record.inDateTime.seconds * 1000 : record.inDateTime).toISOString().startsWith(dateFilter));

      return searchMatch && plantMatch && statusMatch && inOutMatch && dateMatch;
    });
  }, [searchQuery, plantFilter, statusFilter, inOutFilter, dateFilter, vehicleData]);

  const handleExport = () => {
    // Now exports the currently filtered data
    const dataToExport = filteredData.length > 0 ? filteredData : (vehicleData || []);
    if (dataToExport.length === 0) {
      alert("No data to export.");
      return;
    }
    const worksheet = utils.json_to_sheet(dataToExport);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'VehicleRecords');
    writeFile(workbook, 'VehicleRecords.xlsx');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>{pageTitle}</h1>
        {tcode && <span className="text-xs font-bold text-slate-500">T-CODE: {tcode}</span>}
      </header>

      <div className={styles.tabContent}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
          <input
            type="search"
            placeholder="Search Vehicle Number, Driver Name, Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.formInput}
            style={{width: '300px'}}
          />
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={styles.formInput} />
          <select value={plantFilter} onChange={(e) => setPlantFilter(e.target.value)} className={styles.formInput}>
            <option value="">Filter by Plant</option>
            {authorizedPlants.length === 0 && <option value="">No Plants Available</option>}
            {authorizedPlants.map((p) => (
              <option key={p.id} value={p.plantCode}>{p.plantCode}</option>
            ))}
            <option key="outside" value="Outside">
              Outside
            </option>
          </select>
          <select value={inOutFilter} onChange={(e) => setInOutFilter(e.target.value)} className={styles.formInput}>
            <option value="">Filter by IN/OUT</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={styles.formInput}>
            <option value="">Filter by Status</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button onClick={handleExport} className={styles.button}>
            Export to Excel
          </button>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Plant</th>
              <th>Vehicle Number</th>
              <th>Driver Name</th>
              <th>Driver Mobile</th>
              <th>In Date Time</th>
              <th>Current Status</th>
              <th>Status Time</th>
              <th>Customer</th>
              <th>Ship to Party</th>
              <th>Destination</th>
              <th>Remark</th>
              <th>Out Type</th>
              <th>CN Numbers</th>
              <th>Out Date Time</th>
              <th>Stay Hour</th>
              <th>Loaded Stay Hour</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={16} style={{textAlign: 'center', padding: '20px'}}>Loading...</td></tr>}
            {!isLoading && filteredData.map((record: any) => (
              <tr key={record.id}>
                <td>{record.plant}</td>
                <td>{record.vehicleNo}</td>
                <td>{record.driverName}</td>
                <td>{record.driverMobile}</td>
                <td>{formatDateTime(record.inDateTime)}</td>
                <td>{record.currentStatus}</td>
                <td>{formatDateTime(record.statusDateTime)}</td>
                <td>{record.customer}</td>
                <td>{record.shipToParty}</td>
                <td>{record.destination}</td>
                <td>{record.remark}</td>
                <td>{record.outType}</td>
                <td>{record.cnRows?.map((row: any) => row.cnNumber).filter(Boolean).join(', ') || '-'}</td>
                <td>{formatDateTime(record.outDateTime)}</td>
                <td>{calculateStayHours(record.inDateTime, record.outDateTime)}</td>
                <td>{calculateStayHours(record.loadDateTime, record.outDateTime)}</td>
              </tr>
            ))}
            {!isLoading && filteredData.length === 0 && <tr><td colSpan={16} style={{textAlign: 'center', padding: '20px'}}>No records found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function VT03Page() {
  return (
    <Suspense fallback={<div className={styles.container}>Loading...</div>}>
      <VT03Content />
    </Suspense>
  );
}
