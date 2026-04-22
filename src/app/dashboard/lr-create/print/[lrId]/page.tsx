
'use client';

import { LRPrintClient } from './LRPrintClient';

/**
 * @fileOverview LR Print Page Node (Client Component).
 * Standardized as a Client Component to resolve useContext errors during mission manifest extraction.
 */
export default function Page({ params }: { params: { lrId: string } }) {
  const { lrId } = params;
  return <LRPrintClient lrId={lrId} />;
}
