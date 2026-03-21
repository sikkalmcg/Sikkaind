'use client';
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { WithId, FuelPayment, SubUser, FuelPump } from '@/types';
import { mockFuelPayments, mockPlants } from '@/lib/mock-data';
import FuelDataTab from '@/components/dashboard/fuel-payment/FuelDataTab';
import PaymentWindowTab from '@/components/dashboard/fuel-payment/PaymentWindowTab';
import PaidRecordsTab from '@/components/dashboard/fuel-payment/PaidRecordsTab';
import { useFirestore, useUser } from "@/firebase";
import { collection, query, getDocs, orderBy, doc, getDoc, Timestamp, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { Loader2, WifiOff } from "lucide-react";

export default function FuelPaymentPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    const [payments, setPayments] = useState<WithId<FuelPayment>[]>([]);
    const [pumps, setPumps] = useState<WithId<FuelPump>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dbError, setDbError] = useState(false);
    const [dataVersion, setDataVersion] = useState(0);

    const refreshData = () => setDataVersion(v => v + 1);

    useEffect(() => {
        if (!firestore || !user) return;

        const fetchData = async () => {
            setIsLoading(true);
            setDbError(false);
            try {
                // 1. Fetch Pumps for name resolution
                const pumpSnapshot = await getDocs(collection(firestore, "fuel_pumps"));
                const fetchedPumps = pumpSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as WithId<FuelPump>));
                setPumps(fetchedPumps);

                // 2. Fetch Payments
                const q = query(collection(firestore, "fuel_payments"), orderBy("paymentDate", "desc"));
                const snapshot = await getDocs(q);
                
                const fetchedPayments: WithId<FuelPayment>[] = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        paymentDate: data.paymentDate instanceof Timestamp ? data.paymentDate.toDate() : new Date(data.paymentDate),
                        fromDate: data.fromDate instanceof Timestamp ? data.fromDate.toDate() : new Date(data.fromDate),
                        toDate: data.toDate instanceof Timestamp ? data.toDate.toDate() : new Date(data.toDate),
                    } as WithId<FuelPayment>;
                });

                if (fetchedPayments.length === 0) {
                    setPayments(mockFuelPayments.sort((a,b) => b.paymentDate.getTime() - a.paymentDate.getTime()));
                } else {
                    setPayments(fetchedPayments);
                }
            } catch (error) {
                console.error("Error fetching fuel payment data:", error);
                setDbError(true);
                setPayments(mockFuelPayments.sort((a,b) => b.paymentDate.getTime() - a.paymentDate.getTime()));
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [firestore, user, dataVersion]);

    const handlePaymentSaved = (data: Omit<FuelPayment, 'id'>) => {
        toast({ title: 'Success', description: 'Payment has been successfully recorded in the database.' });
        refreshData();
    };

    const handlePaymentDeleted = async (paymentId: string) => {
        if (!firestore || !user) return;
        try {
            const payRef = doc(firestore, "fuel_payments", paymentId);
            const paySnap = await getDoc(payRef);

            if (paySnap.exists()) {
                const payData = paySnap.data();
                // Move to Recycle Bin (Soft Delete)
                await addDoc(collection(firestore, "recycle_bin"), {
                    pageName: "Fuel Payment",
                    userName: user.email?.split('@')[0] || "Admin",
                    deletedAt: serverTimestamp(),
                    data: { ...payData, id: paymentId, type: 'FuelPayment' }
                });

                await deleteDoc(payRef);
                toast({ title: 'Moved to Bin', description: 'The payment record has been moved to the Recycle Bin.' });
                refreshData();
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold font-headline">Fuel Payment</h1>
                {dbError && (
                    <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-medium">
                        <WifiOff className="h-3 w-3" />
                        <span>Offline/Demo Mode</span>
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <Tabs defaultValue="payment-window" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 max-w-lg">
                        <TabsTrigger value="payment-window">Payment Window</TabsTrigger>
                        <TabsTrigger value="paid-records">Paid Records</TabsTrigger>
                        <TabsTrigger value="fuel-data">Fuel Data</TabsTrigger>
                    </TabsList>
                    <TabsContent value="payment-window">
                        <PaymentWindowTab onPaymentMade={handlePaymentSaved} />
                    </TabsContent>
                    <TabsContent value="paid-records">
                        <PaidRecordsTab 
                            payments={payments} 
                            pumps={pumps}
                            onPaymentDeleted={handlePaymentDeleted} 
                        />
                    </TabsContent>
                    <TabsContent value="fuel-data">
                        <FuelDataTab />
                    </TabsContent>
                </Tabs>
            )}
        </main>
    );
}
