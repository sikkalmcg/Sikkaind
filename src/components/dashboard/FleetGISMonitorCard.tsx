'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radar, Loader2, RefreshCcw, AlertTriangle } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';

interface FleetStats {
  moving: number;
  idle: number;
  parked: number;
  total: number;
}

export default function FleetGISMonitorCard() {
  const firestore = useFirestore();
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    const fetchApiKey = async () => {
      if (!firestore) return;
      const settingsDoc = doc(firestore, 'gps_settings', 'api_config');
      try {
        const docSnap = await getDoc(settingsDoc);
        if (docSnap.exists() && docSnap.data().apiKey) {
          setApiKey(docSnap.data().apiKey);
        } else {
          setError('API key is not configured.');
        }
      } catch (err) {
        setError('Could not fetch API configuration.');
      }
    };
    fetchApiKey();
  }, [firestore]);

  const fetchFleetData = async () => {
    if (!apiKey) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      if (!response.ok) throw new Error('Failed to fetch fleet data');
      const data = await response.json();

      if (Array.isArray(data)) {
        const newStats = data.reduce(
          (acc, vehicle) => {
            if (vehicle.speed > 5) acc.moving++;
            else if (vehicle.ignition) acc.idle++;
            else acc.parked++;
            return acc;
          },
          { moving: 0, idle: 0, parked: 0, total: data.length }
        );
        setStats(newStats);
        setLastUpdated(new Date());
      }
    } catch (err) {
      setError('Failed to load fleet data.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (apiKey) {
      fetchFleetData();
      const interval = setInterval(fetchFleetData, 60000); // Refresh every 60 seconds
      return () => clearInterval(interval);
    }
  }, [apiKey]);

  return (
    <Card className="bg-slate-900 text-white shadow-lg rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-3">
          <Radar className="text-cyan-400" />
          Fleet GIS Monitor
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchFleetData} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <p>{error}</p>
          </div>
        )}
        {stats && (
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-slate-400">Total Vehicles</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{stats.moving}</p>
              <p className="text-xs text-slate-400">Moving</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">{stats.idle}</p>
              <p className="text-xs text-slate-400">Idle</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-500">{stats.parked}</p>
              <p className="text-xs text-slate-400">Parked</p>
            </div>
          </div>
        )}
        {lastUpdated && (
          <p className="text-xs text-slate-500 text-center mt-4">
            Last updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
