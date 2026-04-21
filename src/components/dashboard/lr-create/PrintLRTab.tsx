'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { mockLrs as initialLrs, mockTrips, mockCarriers, mockShipments } from '@/lib/mock-data';
import type { WithId, Carrier } from '@/types';
import { Search, Loader2, Printer, FileDown, Eye } from 'lucide-react';
import { useFirestore } from "@/firebase";
import { collection, query, where, getDocs, limit, doc, getDoc, Timestamp } from "firebase/firestore";
import LRPrintPreviewModal from './LRPrintPreviewModal';
import { type EnrichedLR } from '@/components/dashboard/vehicle-assign/PrintableLR';

interface PrintLRTabProps {
    selectedPlantId: string;
}

export default function PrintLRTab({ selectedPlantId }: PrintLRTabProps) {
    const [lrNumber, setLrNumber] = useState('');
    const [foundLr, setFoundLr] = useState<EnrichedLR | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();
    const [dbCarriers, setDbCarriers] = useState<WithId<Carrier>[]>([]);
    
    const availableCarriers = useMemo(() => {
        return dbCarriers.length > 0 ? dbCarriers : mockCarriers;
    }, [dbCarriers]);

    const handleSearch = async () => {
        setFoundLr(null);
        const trimmedLr = lrNumber.trim();
        if (!trimmedLr) {
            toast({ variant: 'destructive', title: 'LR Number Required' });
            return;
        }

        setIsSearching(true);
        try {
            if (firestore) {
                const carrierSnap = await getDocs(collection(firestore, "carriers"));
                setDbCarriers(carrierSnap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<Carrier>)));
            }

            let lrData: any = null;
            if (firestore && selectedPlantId) {
                const q = query(
                    collection(firestore, `plants/${selectedPlantId}/lrs`),
                    where("lrNumber", "==", trimmedLr),
                    limit(1)
                );
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const d = snapshot.docs[0];
                    lrData = { id: d.id, ...d.data() };
                }
            }

            if (!lrData) {
                lrData = initialLrs.find(l => l.lrNumber.toLowerCase() === trimmedLr.toLowerCase());
            }

            if (!lrData) throw new Error(`LR "${trimmedLr}" not found.`);

            const plantId = lrData.originPlantId || selectedPlantId;
            let trip: any = null;
            if (firestore) {
                const tSnap = await getDoc(doc(firestore, `plants/${plantId}/trips`, lrData.tripId));
                if (tSnap.exists()) trip = { id: tSnap.id, ...tSnap.data() };
            }
            if (!trip) trip = mockTrips.find(t => t.id === lrData.tripId);
            if (!trip) throw new Error("Associated Trip not found.");

            const carrier = availableCarriers.find(c => c.id === lrData.carrierId) || availableCarriers[0];

            let shipment: any = null;
            const shipId = trip.shipmentIds?.[0];
            if (shipId) {
                if (firestore) {
                    const sSnap = await getDoc(doc(firestore, `plants/${plantId}/shipments`, shipId));
                    if (sSnap.exists()) shipment = { id: sSnap.id, ...sSnap.data() };
                }
                if (!shipment) shipment = mockShipments.find(s => s.id === shipId);
            }

            setFoundLr({ 
                ...lrData, 
                trip, 
                carrier, 
                shipment,
                date: lrData.date instanceof Timestamp ? lrData.date.toDate() : new Date(lrData.date)
            } as EnrichedLR);

            toast({ variant: 'success', title: 'LR Found' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Search Error", description: error.message });
        } finally {
            setIsSearching(false);
        }
    };
    
    const handleAction = () => {
        if (!foundLr) return;
        setIsPreviewOpen(true);
    };

    const handleCancel = () => {
        setLrNumber('');
        setFoundLr(null);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Print Lorry Receipt</CardTitle>
                    <CardDescription>Search for an LR number to preview or print.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-end gap-2 max-w-sm">
                        <div className="grid w-full gap-1.5">
                            <Label htmlFor="lrNumberInput">LR Number</Label>
                            <Input 
                                id="lrNumberInput"
                                placeholder="Enter LR Number"
                                value={lrNumber}
                                onChange={(e) => setLrNumber(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={isSearching}>
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4"/>}
                            Search
                        </Button>
                    </div>

                    {foundLr && (
                        <div className="flex flex-wrap gap-4 border-t pt-6 animate-in fade-in duration-300">
                            <div className='w-full p-4 bg-slate-50 rounded-lg border border-slate-100'>
                                <p className='text-sm font-bold text-blue-900'>Ready to Print: #{foundLr.lrNumber}</p>
                                <p className='text-xs text-muted-foreground'>Trip: {foundLr.trip?.tripId} | Carrier: {foundLr.carrier?.name}</p>
                            </div>
                            <Button onClick={handleAction} className="bg-blue-600 hover:bg-blue-700 gap-2">
                                <Eye className="h-4 w-4" /> Preview & Print
                            </Button>
                            <Button onClick={handleCancel} variant="ghost" className="text-destructive hover:bg-destructive/10">
                                Clear
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {foundLr && (
                <LRPrintPreviewModal 
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    lr={foundLr}
                />
            )}
        </>
    );
}