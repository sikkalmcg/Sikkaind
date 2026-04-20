
'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const TrackingMap = dynamic(() => import('./TrackingMap'), { ssr: false });

interface VehicleMapProps {
  vehicleNo: string;
  livePos?: any;
  origin: { lat: number; lng: number; name: string };
  destination: string | { lat: number; lng: number; name: string };
}

/**
 * @fileOverview VehicleMap Wrapper.
 * A simplified proxy for individual vehicle mission tracking.
 */
export default function VehicleMap(props: VehicleMapProps) {
  return <TrackingMap {...props} height="600px" />;
}
