import { LRPrintClient } from './LRPrintClient';

/**
 * @fileOverview LR Print Page Node (Server Component).
 * Manages static parameter generation for the mission registry.
 */

export function generateStaticParams() {
  return [{ lrId: 'default' }];
}

export default function Page({ params }: { params: { lrId: string } }) {
  const { lrId } = params;
  return <LRPrintClient lrId={lrId} />;
}
