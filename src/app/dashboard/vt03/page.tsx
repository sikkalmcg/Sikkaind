'use client';
import type { NextPage } from 'next';
import { useState, useEffect, useMemo } from 'react';
import styles from '../../../../VT01.module.css';
import { useSearchParams } from 'next/navigation';
import { useMongoStore, useCollectionOptimized, useMemoMongo, useUser } from '@/mongodb';
import { collection } from '@/lib/mongo-store';
import { Toaster } from 'react-hot-toast';
import { Download } from 'lucide-react';

const SHARED_HUB_ID = 'Sikkaind';

interface PlantOption {
  id: string;
  plantCode: string;
  plantName: string;
  status: string;
}

interface ReportRow {
  id: string;
  plant: string;
  vehicleNo: string;
  driverName: string;
  driverMobile: string;
  inDateTime: string; // Entry Date Time
  status?: string;
  statusDateTime?: string; // From Date Time
  toDateTime?: string; // To Date Time
  duration?: string;
  outDateTime?: string; // Exit Date Time
  updatedAt?: string; // Updated Date Time
  updatedBy?: string; // User
}

// --- Helper Functions ---
const formatDateTime = (dateTimeString: string): string => {
  if (!dateTimeString) return '-';
  try {
    return new Date(dateTimeString).toLocaleString();
  } catch (e) {
    return '-';
  }
};

const calculateDuration = (start: string, end: string): string => {
  if (!start) return '-';
  const now = new Date().getTime();
  const endDate = end ? new Date(end).getTime() : now; // Use current time if end is not provided
  try {
    const startDate = new Date(start).getTime();
    if (isNaN(startDate) || isNaN(endDate) || endDate < startDate) return '-';
    const diffMs = endDate - startDate;
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } catch (e) {
    return '-';
  }
};

const VT03Page: NextPage = () => {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'Report' | 'Dashboard'>('Report');
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [plantFilter, setPlantFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  const db = useMongoStore();
  const { user } = useUser();

  const vehicleMovementsQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'vehicle_movements'),
    [db],
  );
  const { data: allVehicleMovements } = useCollectionOptimized(vehicleMovementsQuery);

  const statusHistoryQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'vehicle_status_history'),
    [db],
  );
  const { data: allStatusHistory } = useCollectionOptimized(statusHistoryQuery);

  const usersMasterQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'users_master'),
    [db],
  );
  const { data: allUsers } = useCollectionOptimized(usersMasterQuery);

  // OX03 Plant Master is the single source for plant selections in VT01/02/03.
  useEffect(() => {
    const fetchPlants = async () => {
      try {
        const response = await fetch('/api/plants');
        if (!response.ok) {
          throw new Error('Unable to fetch Plant Master data.');
        }

        const data: PlantOption[] = await response.json();
        setPlants(data.filter((plant) => plant.status === 'Active'));
      } catch (error) {
        console.error('Failed to fetch plants:', error);
      }
    };

    fetchPlants();
  }, []);

  const reportData = useMemo(() => {
    if (!allVehicleMovements || !allStatusHistory || !allUsers) return [];

    const userMap = new Map(allUsers.map(u => [u.email, u.name]));
    const getUserName = (email: string) => {
      if (!email) return '-';
      return userMap.get(email) || email;
    };

    const [year, month] = monthYear.split('-').map(Number);

    const filteredMovements = allVehicleMovements.filter(m => {
      const inDate = new Date(m.inDateTime);
      const matchesMonthYear = inDate.getFullYear() === year && (inDate.getMonth() + 1) === month;
      const matchesPlant = !plantFilter || m.plant === plantFilter;
      const matchesSearch = !searchQuery ||
        m.vehicleNo?.toUpperCase().includes(searchQuery.toUpperCase()) ||
        m.driverName?.toUpperCase().includes(searchQuery.toUpperCase()) ||
        m.driverMobile?.includes(searchQuery);

      return matchesMonthYear && matchesPlant && matchesSearch;
    });

    const finalReport: ReportRow[] = [];

    filteredMovements.forEach(m => {
      const vehicleStatuses = allStatusHistory
        .filter(s => s.vehicleNo === m.vehicleNo && s.plant === m.plant)
        .sort((a, b) => new Date(a.statusDateTime).getTime() - new Date(b.statusDateTime).getTime());

      if (vehicleStatuses.length > 0) {
        vehicleStatuses.forEach((status, index) => {
          finalReport.push({
            id: `${m.id}-${status.id}`,
            plant: m.plant === 'Outside' ? 'N/A' : m.plant,
            vehicleNo: m.vehicleNo,
            driverName: index === 0 ? m.driverName : '',
            driverMobile: index === 0 ? m.driverMobile : '',
            inDateTime: index === 0 ? m.inDateTime : '',
            status: status.currentStatus,
            statusDateTime: status.statusDateTime,
            toDateTime: status.toDateTime,
            duration: calculateDuration(status.statusDateTime, status.toDateTime),
            outDateTime: '', // Exit time is shown on the last row
            updatedAt: status.updatedAt || m.updatedAt, // Fallback to movement's updatedAt if status's is missing
            updatedBy: getUserName(status.updatedBy || m.updatedBy),
          });
        });
        // Add exit row if applicable
        if (m.outDateTime) {
          const lastRow = finalReport[finalReport.length - 1];
          if (lastRow && lastRow.vehicleNo === m.vehicleNo) {
            lastRow.outDateTime = m.outDateTime;
          } else { // If no status history, but has exit time
            finalReport.push({
              id: `${m.id}-exit`,
              plant: m.plant === 'Outside' ? 'N/A' : m.plant,
              vehicleNo: m.vehicleNo,
              driverName: m.driverName,
              driverMobile: m.driverMobile,
              inDateTime: m.inDateTime,
              outDateTime: m.outDateTime,
              updatedAt: m.updatedAt,
              updatedBy: getUserName(m.updatedBy),
            });
          }
        }
      } else {
        // Vehicle with no status history
        finalReport.push({
          id: m.id,
          plant: m.plant === 'Outside' ? 'N/A' : m.plant,
          vehicleNo: m.vehicleNo,
          driverName: m.driverName,
          driverMobile: m.driverMobile,
          inDateTime: m.inDateTime,
          status: m.currentStatus || 'IN',
          statusDateTime: m.inDateTime,
          toDateTime: m.outDateTime,
          duration: calculateDuration(m.inDateTime, m.outDateTime),
          outDateTime: m.outDateTime,
          updatedAt: m.updatedAt, // Use movement's updatedAt
          updatedBy: getUserName(m.updatedBy),
        });
      }
    });

    return finalReport;
  }, [allVehicleMovements, allStatusHistory, allUsers, monthYear, plantFilter, searchQuery]);

  const dashboardData = useMemo(() => {
    if (!allVehicleMovements || !allStatusHistory || !allUsers) return [];

    const userMap = new Map(allUsers.map(u => [u.email, u.name]));
    const getUserName = (email: string) => {
      if (!email) return '-';
      return userMap.get(email) || email;
    };

    // Get all vehicles that are either in-plant (not exited) or are designated as non-plant vehicles.
    const activeVehicles = allVehicleMovements.filter(m =>
      (m.plant !== 'Outside' && !m.outDateTime) || m.plant === 'Outside'
    );
    return activeVehicles.map(vehicle => {
      // Find the last status update for this vehicle
      const vehicleStatuses = allStatusHistory
        .filter(s => s.vehicleNo === vehicle.vehicleNo && s.plant === vehicle.plant)
        .sort((a, b) => new Date(b.statusDateTime).getTime() - new Date(a.statusDateTime).getTime());

      const lastStatus = vehicleStatuses[0];

      if (lastStatus) {
        return {
          id: vehicle.id,
          plant: vehicle.plant === 'Outside' ? 'Non-Plant' : vehicle.plant,
          vehicleNo: vehicle.vehicleNo,
          currentStatus: lastStatus.currentStatus,
          duration: calculateDuration(lastStatus.statusDateTime, lastStatus.toDateTime),
          remark: lastStatus.remark,
          user: getUserName(lastStatus.updatedBy || vehicle.updatedBy),
        };
      }

      // If no status history, use the entry record itself
      return {
        id: vehicle.id,
        plant: vehicle.plant === 'Outside' ? 'Non-Plant' : vehicle.plant,
        vehicleNo: vehicle.vehicleNo,
        currentStatus: vehicle.currentStatus || 'IN',
        duration: calculateDuration(vehicle.inDateTime, ''),
        remark: vehicle.remark, 
        user: getUserName(vehicle.updatedBy)
      };
    }).filter(Boolean); // Filter out any null/undefined entries
  }, [allVehicleMovements, allStatusHistory, allUsers]);

  const handleMonthChange = (increment: number) => {
    const [year, month] = monthYear.split('-').map(Number);
    // Use UTC to avoid timezone issues
    const currentDate = new Date(Date.UTC(year, month - 1, 1));
    currentDate.setUTCMonth(currentDate.getUTCMonth() + increment);
    const newYear = currentDate.getUTCFullYear();
    const newMonth = (currentDate.getUTCMonth() + 1).toString().padStart(2, '0');
    setMonthYear(`${newYear}-${newMonth}`);
  };

  const handleDownloadCsv = () => {
    if (reportData.length === 0) {
      alert("No data available to download.");
      return;
    }

    const headers = [
      "Plant", "Vehicle Number", "Driver Name", "Mobile", "Entry Date Time",
      "Status", "From Date Time", "To Date Time", "Duration", "Exit Date Time",
      "Updated Date Time", "User"
    ];

    // A helper to format values for CSV, handling commas and quotes
    const formatCsvValue = (value: any) => {
      if (value === null || value === undefined) {
        return '""';
      }
      const stringValue = String(value).replace(/"/g, '""'); // Escape double quotes
      return `"${stringValue}"`;
    };

    const csvRows = [
      headers.join(','), // Header row
      ...reportData.map(row => [
        formatCsvValue(row.plant),
        formatCsvValue(row.vehicleNo),
        formatCsvValue(row.driverName),
        formatCsvValue(row.driverMobile),
        formatCsvValue(row.inDateTime ? formatDateTime(row.inDateTime) : ''),
        formatCsvValue(row.status),
        formatCsvValue(row.statusDateTime ? formatDateTime(row.statusDateTime) : ''),
        formatCsvValue(row.toDateTime ? formatDateTime(row.toDateTime) : ''),
        formatCsvValue(row.duration),
        formatCsvValue(row.outDateTime ? formatDateTime(row.outDateTime) : ''),
        formatCsvValue(row.updatedAt ? formatDateTime(row.updatedAt) : ''),
        formatCsvValue(row.updatedBy),
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `VT03_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'Report':
        return (
          <div className={styles.tableWrapper || ''}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Plant</th>
                  <th>Vehicle Number</th>
                  <th>Driver Name</th>
                  <th>Mobile</th>
                  <th>Entry Date Time</th>
                  <th>Status</th>
                  <th>From Date Time</th>
                  <th>To Date Time</th>
                  <th>Duration</th>
                  <th>Exit Date Time</th>
                  <th>Updated Date Time</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {reportData.length > 0 ? (
                  reportData.map((row) => (
                    <tr key={row.id}>
                      <td>{row.plant}</td>
                      <td>{row.vehicleNo}</td>
                      <td>{row.driverName}</td>
                      <td>{row.driverMobile}</td>
                      <td>{row.inDateTime ? formatDateTime(row.inDateTime) : ''}</td>
                      <td>{row.status || '-'}</td>
                      <td>{row.statusDateTime ? formatDateTime(row.statusDateTime) : '-'}</td>
                      <td>{row.toDateTime ? formatDateTime(row.toDateTime) : '-'}</td>
                      <td>{row.duration || '-'}</td>
                      <td>{row.outDateTime ? formatDateTime(row.outDateTime) : ''}</td>
                      <td>{row.updatedAt ? formatDateTime(row.updatedAt) : '-'}</td>
                      <td>{row.updatedBy || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center' }}>No records found for the selected criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      case 'Dashboard':
        return (
            <div className={styles.tableWrapper || ''}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Plant</th>
                    <th>Vehicle Number</th>
                    <th>Current Status</th>
                    <th>Duration</th>
                    <th>Remarks</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.length > 0 ? (
                    dashboardData.map((row) => (
                      <tr key={row.id}>
                        <td>{row.plant}</td>
                        <td>{row.vehicleNo}</td>
                        <td>{row.currentStatus || '-'}</td>
                        <td>{row.duration || '-'}</td>
                        <td>{row.remark || '-'}</td>
                        <td>{row.user || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center' }}>
                        No vehicles currently in any plant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <Toaster position="top-center" reverseOrder={false} />
      <h1 className={styles.headerTitle}>VT03 - Vehicle Report</h1>
      {activeTab === 'Report' && (
        <div className={styles.formContainer} style={{ marginBottom: '1rem', gridTemplateColumns: '1fr 1fr 2fr auto' }}>
          <div className={styles.formGroup}>
            <label>Month-Year:</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ccc', borderRadius: '4px' }}>
              <button onClick={() => handleMonthChange(-1)} className={styles.button} style={{ border: 'none', background: 'transparent' }}>&lt;</button>
              <div style={{ textAlign: 'center', flexGrow: 1, padding: '0 10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                {new Date(monthYear + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </div>
              <button onClick={() => handleMonthChange(1)} className={styles.button} style={{ border: 'none', background: 'transparent' }}>&gt;</button>
            </div>
          </div>
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
          <div className={styles.formGroup}>
            <label htmlFor="search-filter">Search:</label>
            <input
              id="search-filter"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.formInput}
              placeholder="Search by Vehicle No, Driver Name, Mobile..."
            />
          </div>
          <div className={styles.formGroup} style={{ alignSelf: 'flex-end', display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => { /* Search is real-time */ }} className={styles.button}>Search</button>
            <button onClick={handleDownloadCsv} className={styles.button} title="Download Report as CSV">
              <Download size={16} />
            </button>
          </div>
        </div>
      )}
      <div className={styles.tabContainer}>
        <button onClick={() => setActiveTab('Report')} disabled={activeTab === 'Report'} className={styles.tabButton}>
          Report
        </button>
        <button onClick={() => setActiveTab('Dashboard')} disabled={activeTab === 'Dashboard'} className={styles.tabButton}>
          Dashboard
        </button>
      </div>
      <div className={styles.tabContent}>
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default VT03Page;