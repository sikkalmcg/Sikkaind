'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc } from '@/lib/mongo-store';
import { useMongoStore, useCollectionOptimized, useMemoMongo, useDoc, useUser } from '@/mongodb';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, QrCode, Printer } from 'lucide-react';
import { QRScanner } from '@/components/qr/QRScanner';

const SHARED_HUB_ID = 'Sikkaind';

function normalizeCn(input: string) {
  return (input || '').toString().trim().toUpperCase();
}

function extractMaybeCnFromScannedText(text: string) {
  const raw = (text || '').toString().trim();
  if (!raw) return '';

  // If QR contains a URL, try to extract last path segment
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      const seg = u.pathname.split('/').filter(Boolean).pop();
      return normalizeCn(seg || raw);
    }
  } catch {
    // ignore
  }

  // If QR contains JSON
  if (raw.startsWith('{') && raw.includes('cn')) {
    try {
      const obj = JSON.parse(raw);
      const cn = obj.cnNumber || obj.cn || obj.CN || obj.consignmentNo || obj.consignmentNumber;
      if (cn) return normalizeCn(String(cn));
    } catch {
      // ignore
    }
  }

  // Default: treat entire text as CN
  return normalizeCn(raw);
}

export default function QRScanCNPage() {
  const router = useRouter();
  const db = useMongoStore();
  const { user } = useUser();

  const [mounted, setMounted] = React.useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [registryId, setRegistryId] = React.useState<string | null>(null);

  const [scannedCn, setScannedCn] = React.useState<string>('');

  React.useEffect(() => {
    setIsBootstrapAdmin(localStorage.getItem('sap_bootstrap_session') === 'true');
    setRegistryId(localStorage.getItem('sap_registry_id'));
    setMounted(true);
  }, []);

  const profileRef = useMemoMongo(() => {
    if (!registryId || isBootstrapAdmin) return null;
    return doc(db, 'users', SHARED_HUB_ID, 'users_master', registryId);
  }, [db, registryId, isBootstrapAdmin]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(profileRef);

  const authorizedPlantCodes = React.useMemo(() => {
    if (isBootstrapAdmin) return null;
    return userProfile?.plantAccess || [];
  }, [isBootstrapAdmin, userProfile]);

  const tripBoardQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'trip_board'),
    [db]
  );
  const { data: trips } = useCollectionOptimized(tripBoardQuery);

  const matchingTrips = React.useMemo(() => {
    if (!scannedCn) return [];
    const cn = normalizeCn(scannedCn);

    const list = Array.isArray(trips) ? trips : [];

    const authorizedFiltered =
      isBootstrapAdmin
        ? list
        : authorizedPlantCodes?.length
          ? list.filter((t: any) => authorizedPlantCodes.includes(t.plantCode))
          : [];

    return authorizedFiltered.filter((t: any) => normalizeCn(t.cnNumber) === cn);
  }, [scannedCn, trips, isBootstrapAdmin, authorizedPlantCodes]);

  const selectedTrip = matchingTrips[0];

  const handleScanned = React.useCallback(
    (rawText: string) => {
      const cn = extractMaybeCnFromScannedText(rawText);
      if (!cn) {
        alert('Invalid CN in QR');
        return;
      }
      setScannedCn(cn);
    },
    []
  );

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-8 bg-[#f2f2f2] font-mono text-black">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-6 shadow-sm flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <QrCode className="h-5 w-5 text-[#1e3a8a]" />
          <h2 className="text-[16px] font-bold uppercase italic">CN QR Scan</h2>
        </div>
        <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
          Scan → CN number match → show full details
        </div>
      </div>

      <div className="bg-white border border-slate-300 shadow-inner p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="text-[12px] font-black uppercase text-slate-600 mb-3">QR Scanner</div>
            <QRScanner onScan={handleScanned} />
            <div className="mt-4 text-[10px] text-slate-500">
              Tip: QR text should contain CN Number (or a URL/JSON including cnNumber).
            </div>
          </div>

          <div className="w-full lg:w-[420px]">
            <div className="text-[12px] font-black uppercase text-slate-600 mb-3">Lookup</div>
            <div className="flex flex-col gap-3">
              <div className="space-y-1.5">
                <div className="text-[10px] font-normal text-slate-500 uppercase">Scanned CN</div>
                <input
                  value={scannedCn}
                  readOnly
                  className="h-10 w-full border border-slate-400 px-3 text-xs font-black uppercase outline-none bg-slate-50"
                  placeholder="Scan to load"
                />
              </div>

              <div className="mt-2">
                {isProfileLoading && !isBootstrapAdmin ? (
                  <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking authorization...
                  </div>
                ) : matchingTrips.length === 0 && scannedCn ? (
                  <div className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 p-3">
                    No trip found for this CN (or not authorized).
                  </div>
                ) : matchingTrips.length > 0 ? (
                  <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 p-3">
                    Found {matchingTrips.length} record(s)
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500">Scan a CN to search.</div>
                )}
              </div>

              {selectedTrip?.id && (
                <Button
                  onClick={() => router.push(`/dashboard/tr21/print/${selectedTrip.id}`)}
                  className="h-10 bg-[#0056d2] text-white rounded-none text-[11px] font-black uppercase shadow-sm flex items-center justify-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Open CN Print
                </Button>
              )}

              {selectedTrip?.id && (
                <Button
                  onClick={() => window.open(`/dashboard/tr21/print/${selectedTrip.id}`, '_blank')}
                  variant="outline"
                  className="h-10 rounded-none text-[11px] font-black uppercase"
                >
                  Open in new tab
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedTrip ? (
        <div className="bg-white border border-slate-300 shadow-inner p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <div>
              <div className="text-[12px] font-black uppercase text-[#1e3a8a]">CN Details</div>
              <div className="text-[10px] text-slate-500 uppercase">CN: {selectedTrip.cnNumber}</div>
            </div>
            <div
              className={cn(
                'px-3 py-1 rounded-sm text-[10px] font-black uppercase border',
                selectedTrip.status === 'CLOSED'
                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                  : selectedTrip.podUrl
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
              )}
            >
              Status: {selectedTrip.status || '-'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
            <div className="space-y-2">
              <div className="bg-slate-50 border border-slate-200 p-3">
                <div className="text-[9px] font-black uppercase text-slate-500">Trip</div>
                <div className="mt-1"><span className="font-black text-[#0056d2]">Trip ID:</span> {selectedTrip.id}</div>
                <div className="mt-1"><span className="font-black text-[#0056d2]">Trip No:</span> {selectedTrip.tripNo || selectedTrip.tripId || selectedTrip.tripNo || '-'}</div>
                <div className="mt-1"><span className="font-black text-[#0056d2]">Plant:</span> {selectedTrip.plantCode || '-'}</div>
                <div className="mt-1"><span className="font-black text-[#0056d2]">Order No:</span> {selectedTrip.orderNo || selectedTrip.saleOrderNo || selectedTrip.saleOrder || '-'}</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3">
                <div className="text-[9px] font-black uppercase text-slate-500">Route</div>
                <div className="mt-1">From: {selectedTrip.from || '-'}</div>
                <div className="mt-1">To: {selectedTrip.destination || '-'}</div>
                <div className="mt-1">Via: {selectedTrip.via || '-'}</div>
                <div className="mt-1">Mode: {selectedTrip.mode || '-'}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="bg-slate-50 border border-slate-200 p-3">
                <div className="text-[9px] font-black uppercase text-slate-500">Parties</div>
                <div className="mt-1">Consignor: {selectedTrip.consignorName || selectedTrip.consignorCode || '-'}</div>
                <div className="mt-1">Consignee: {selectedTrip.consigneeName || selectedTrip.consigneeCode || '-'}</div>
                <div className="mt-1">Ship To Party: {selectedTrip.shipToParty || selectedTrip.shipToPartyCode || '-'}</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3">
                <div className="text-[9px] font-black uppercase text-slate-500">Vehicle & Carrier</div>
                <div className="mt-1">Vehicle No: {selectedTrip.vehicleNo || '-'}</div>
                <div className="mt-1">Driver Mobile: {selectedTrip.driverMobile || selectedTrip.driverMobileNumber || '-'}</div>
                <div className="mt-1">Fleet Type: {selectedTrip.fleetType || '-'}</div>
                <div className="mt-1">Carrier: {selectedTrip.carrierName || '-'}</div>
                <div className="mt-1">Vendor: {selectedTrip.vendorName || '-'}</div>
                <div className="mt-1">Arrange By: {selectedTrip.arrangeBy || selectedTrip.arrangeByName || '-'}</div>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="bg-slate-50 border border-slate-200 p-3">
                <div className="text-[9px] font-black uppercase text-slate-500">Consignment Note (CN)</div>
                <div className="mt-1">CN Date: {selectedTrip.cnDate || '-'}</div>
                <div className="mt-1">Payment Terms: {selectedTrip.paymentTerms || selectedTrip.payment_term || '-'}</div>

                <div className="mt-4">
                  <div className="text-[10px] font-black uppercase text-slate-600 mb-2">Invoices</div>
                  <div className="overflow-auto border border-slate-200">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="bg-white sticky top-0">
                        <tr>
                          {['Inv No', 'E-Waybill', 'Goods Desc', 'Package', 'UOM'].map((h) => (
                            <th key={h} className="p-2 border-b border-slate-200 font-black uppercase text-[9px] text-slate-500">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedTrip.invoices || []).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                              No invoice rows
                            </td>
                          </tr>
                        ) : (
                          {(selectedTrip.invoices || []).map((inv: any, idx: number) => (
                            <tr key={inv.id || idx} className="hover:bg-blue-50/20">
                              <td className="p-2 border-b border-slate-100">{inv.invNo || '-'}</td>
                              <td className="p-2 border-b border-slate-100">{inv.ewaybillNo || '-'}</td>
                              <td className="p-2 border-b border-slate-100">{inv.desc || '-'}</td>
                              <td className="p-2 border-b border-slate-100">{inv.pkg ?? '-'} </td>
                              <td className="p-2 border-b border-slate-100">{inv.uom || '-'}</td>
                            </tr>
                          ))}
                        )}

                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        scannedCn && (
          <div className="text-[11px] text-slate-500 italic">Waiting for valid CN scan...</div>
        )
      )}
    </div>
  );
}

