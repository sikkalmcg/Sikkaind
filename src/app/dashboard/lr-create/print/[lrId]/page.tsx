import { LRPrintClient } from './LRPrintClient';

/**
 * @fileOverview LR Print Page Node (Server Component).
 * Manages static parameter generation for the mission registry.
 */

export function generateStaticParams() {
  return [{ lrId: 'default' }];
}

export default async function Page({ params }: { params: Promise<{ lrId: string }> }) {
  const { lrId } = await params;
  return <LRPrintClient lrId={lrId} />;
}
