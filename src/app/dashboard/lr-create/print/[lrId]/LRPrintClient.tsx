
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { WithId, LR, Trip, Shipment, Plant, Carrier } from '@/types';
import PrintableLR, { type EnrichedLR } from '@/components/dashboard/vehicle-assign/PrintableLR';
import { Button } from '@/components/ui/button';
import { useFirestore } from "@/firebase";
import { doc, getDoc, Timestamp, collection, query, where, getDocs, limit } from "firebase/firestore";
import React from 'react';
import { Loader2, Printer, FileDown, ShieldCheck } from 'lucide-react';
import { normalizePlantId } from '@/lib/utils';
import { DEFAULT_LMC_TERMS } from '@/lib/constants';

/**
 * @fileOverview LR Print Client Terminal.
 * Hardened: Force-maps specific plants to their unique carrier identities and addresses.
 * 1214, 1426, ID20, ID23 strictly isolated to prevent registry mix-ups.
 */

function LRPrintContent({ lrId }: { lrId: string }) {
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  
  const plantId = searchParams.get('plantId');
  
  const [lrData, setLrData] = useState<EnrichedLR | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !lrId || lrId === 'default') {
        if (lrId === 'default') setIsLoading(false);
        return;
    }

    const fetchData = async () => {
        setIsLoading(true);
        try {
            let lr: any = null;
            let currentPlantId = plantId;

            if (currentPlantId) {
                const lrRef = doc(firestore, `plants/${currentPlantId}/lrs`, lrId);
                const lrSnap = await getDoc(lrRef);
                if (lrSnap.exists()) {
                    lr = { id: lrSnap.id, ...lrSnap.data() };
                }
            }

            if (!lr) {
                const possiblePlants = ['1214', '1426', 'ID20', 'ID23', 'RAKE'];
                for (const p of possiblePlants) {
                    const lrRef = doc(firestore, `plants/${p}/lrs`, lrId);
                    const lrSnap = await getDoc(lrRef);
                    if (lrSnap.exists()) {
                        lr = { id: lrSnap.id, ...lrSnap.data() };
                        currentPlantId = p;
                        break;
                    }
                }
            }

            if (!lr || !currentPlantId) {
                setLrData(null);
                return;
            }

            const [tripSnap, carrierSnap, plantSnap] = await Promise.all([
                getDoc(doc(firestore, `plants/${currentPlantId}/trips`, lr.tripDocId || lr.tripId)),
                getDoc(doc(firestore, "carriers", lr.carrierId)),
                getDoc(doc(firestore, "logistics_plants", currentPlantId))
            ]);

            const trip = tripSnap.exists() ? { id: tripSnap.id, ...tripSnap.data() } : null;
            const plant = plantSnap.exists() ? { id: plantSnap.id, ...plantSnap.data() } : null;
            
            let carrier = carrierSnap.exists() ? { id: carrierSnap.id, ...carrierSnap.data() } : null;

            // REGISTRY OVERRIDE NODE: Hardened resolution for Sikka LMC nodes - Strictly mapping per plant requirements
            const pIdStr = normalizePlantId(currentPlantId).toUpperCase();
            const carrierNameRaw = (carrier?.name || lr.carrierName || '').toUpperCase();
            const isSikkaLmc = carrierNameRaw.includes('SIKKA');

            if (isSikkaLmc || !carrier) {
                if (pIdStr === 'ID20') {
                    carrier = {
                        id: 'ID20',
                        name: 'SIKKA INDUSTRIES AND LOGISTICS',
                        address: 'PLOT NO. C-17, INDUSTRIAL AREA, SSGT ROAD, GHAZIABAD, Uttar Pradesh, 201009',
                        mobile: '9136688004',
                        gstin: '09AYQPS6936B1ZV',
                        stateCode: '09',
                        stateName: 'UTTAR PRADESH',
                        pan: 'AYQPS6936B',
                        email: 'sil@sikkaenterprises.com',
                        website: 'www.sikkaind.com',
                        terms: DEFAULT_LMC_TERMS
                    };
                } else if (pIdStr === 'ID23') {
                    carrier = {
                        id: 'ID23',
                        name: 'SIKKA INDUSTRIES AND LOGISTICS',
                        address: 'PLOT NO. C-17, INDUSTRIAL AREA, SSGT ROAD, GHAZIABAD 201009',
                        mobile: '9136688004',
                        gstin: '09AYQPS6936B1ZV',
                        stateCode: '09',
                        stateName: 'UTTAR PRADESH',
                        pan: 'AYQPS6936B',
                        email: 'sil@sikkaenterprises.com',
                        website: 'www.sikkaind.com',
                        terms: DEFAULT_LMC_TERMS
                    };
                } else if (pIdStr === '1426') {
                    carrier = {
                        id: '1426',
                        name: 'SIKKA LMC',
                        address: '20Km. Stone, Near Tivoli Grand Resort, Khasra No. -9, G.T. Karnal Road, Jindpur, Delhi - 110036',
                        mobile: '9136688004',
                        gstin: '07AYQPS6936B1ZZ',
                        stateCode: '07',
                        stateName: 'DELHI',
                        pan: 'AYQPS6936B',
                        email: 'sil@sikkaenterprises.com',
                        website: 'www.sikkaind.com',
                        terms: DEFAULT_LMC_TERMS
                    };
                } else if (pIdStr === '1214') {
                    carrier = {
                        id: '1214',
                        name: 'SIKKA LMC',
                        address: 'B-11, BULANDSHAHR ROAD INDLAREA, GHAZIABAD, UTTAR PRADESH, 201009',
                        mobile: '9136688004',
                        gstin: '09AYQPS6936B1ZV',
                        stateCode: '09',
                        stateName: 'UTTAR PRADESH',
                        pan: 'AYQPS6936B',
                        email: 'sil@sikkaenterprises.com',
                        website: 'www.sikkaind.com',
                        terms: DEFAULT_LMC_TERMS
                    };
                }
            }

            let shipment = null;
            if (trip) {
                const shipId = trip.shipmentIds[0];
                const shipSnap = await getDoc(doc(firestore, `plants/${currentPlantId}/shipments`, shipId));
                shipment = shipSnap.exists() ? { id: shipSnap.id, ...shipSnap.data() } : null;
            }

            const parseDate = (d: any) => d instanceof Timestamp ? d.toDate() : (d ? new Date(d) : undefined);
            lr.date = parseDate(lr.date);
            if (trip) {
                trip.startDate = parseDate(trip.startDate);
                trip.lrDate = parseDate(trip.lrDate);
            }

            setLrData({ 
                ...lr, 
                trip: trip as any, 
                carrier: carrier as any, 
                shipment: shipment as any,
                plant: plant as any,
                consignorGtin: lr.consignorGtin || (shipment as any)?.consignorGtin || '',
                buyerGtin: lr.buyerGtin || (shipment as any)?.billToGtin || '',
                shipToGtin: lr.shipToGtin || (shipment as any)?.shipToGtin || '',
                consignorMobile: lr.consignorMobile || (shipment as any)?.consignorMobile || '',
                buyerMobile: lr.buyerMobile || (shipment as any)?.billToMobile || '',
                shipToMobile: lr.shipToMobile || (shipment as any)?.shipToMobile || '',
            } as EnrichedLR);

        } catch (error) {
            console.error("LR Registry Fetch Error:", error);
            setLrData(null);
        } finally {
            setIsLoading(false);
        }
    };

    fetchData();
  }, [lrId, plantId, firestore]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
        <div className="flex h-screen flex-col items-center justify-center bg-slate-50">
            <Loader2 className="h-12 w-12 animate-spin text-blue-900 mb-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Extracting Registry Manifest...</p>
        </div>
    );
  }
  
  if (!lrData || lrId === 'default') {
    return (
        <div className="flex h-screen flex-col items-center justify-center">
            <h1 className="text-xl font-black text-red-600 uppercase">Registry Node Not Found</h1>
            <p className="text-slate-400 text-sm mt-2 font-bold">The requested LR ID is not present in the mission database.</p>
        </div>
    );
  }

  const copies = [
    { type: 'Consignee Copy' },
    { type: 'Driver Copy' },
    { type: 'Consignor Copy' }
  ];

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white flex flex-col items-center">
        <div className="sticky top-0 z-50 w-full bg-slate-900 text-white p-4 flex items-center justify-between shadow-2xl print:hidden">
            <div className="flex items-center gap-4">
                <div className="p-2 bg-blue-600 rounded-lg"><ShieldCheck className="h-5 w-5" /></div>
                <div>
                    <h2 className="text-sm font-black uppercase tracking-tight">Mission Print Terminal</h2>
                    <p className="text-[9px] font-bold text-blue-300 uppercase tracking-widest">LR Registry Ref: {lrData.lrNumber}</p>
                </div>
            </div>
            <div className="flex gap-3">
                <Button variant="outline" className="bg-white/10 border-white/20 text-white font-black text-[10px] uppercase h-10 px-6" onClick={handlePrint}>
                    <FileDown className="h-4 w-4 mr-2" /> Download PDF
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase h-10 px-8 shadow-lg" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" /> Print Document
                </Button>
            </div>
        </div>

        <div id="printable-area" className="w-full flex flex-col items-center gap-12 py-12 print:p-0 print:gap-0">
            {copies.map((copy, index) => (
                <div key={copy.type} className="bg-white shadow-2xl print:shadow-none w-full max-w-[210mm] page-break-after-always last:page-break-after-auto">
                    <PrintableLR 
                        lr={lrData} 
                        copyType={copy.type} 
                        pageNumber={index + 1} 
                        totalInSeries={copies.length} 
                    />
                </div>
            ))}
        </div>
    </div>
  );
}

export function LRPrintClient({ lrId }: { lrId: string }) {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <LRPrintContent lrId={lrId} />
        </Suspense>
    );
}
