import { TripTrackingClient } from './TripTrackingClient';

/**
 * @fileOverview Trip Tracking Page Node (Server Component).
 * Manages static parameter generation for the mission registry.
 */

export function generateStaticParams() {
  return [{ tripId: 'default' }];
}

export default async function Page({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripTrackingClient tripId={tripId} />;
}
