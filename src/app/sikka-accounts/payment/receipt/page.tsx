
'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Invoice, InvoicePayment, Plant, Customer, SubUser } from '@/types';
import { collection, query, where, getDocs, doc, getDoc, limit, Timestamp, orderBy, updateDoc, serverTimestamp, addDoc, onSnapshot } from 'firebase/firestore';
import PaymentReceiptForm from '@/components/sikka-accounts/payment-receipt/PaymentReceiptForm';
import PaymentHistory from '@/components/sikka-accounts/payment-receipt/PaymentHistory';
import { Loader2 } from 'lucide-react';
import { useLoading } from '@/context/LoadingContext';

export default function PaymentReceiptPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { setStatusBar } = useSikkaAccountsPage();
    const { showLoader, hideLoader } = useLoading();
    const [dataVersion, setDataVersion] = useState(0);

    const [history, setHistory] = useState<any[]>([]);
    const [recycled, setRecycled] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_plants")) : null, [firestore]);
    
    // ACCOUNTS REGISTRY HANDSHAKE
    const partiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_parties")) : null, [firestore]);
    
    const { data: plants } = useCollection<Plant>(plantsQuery);
    const { data: parties } = useCollection<Customer>(partiesQuery);

    const refreshData = () => setDataVersion(v => v + 1);

    const isAdmin = useMemo(() => {
        return user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';
    }, [user?.email]);

    useEffect(() => {
        if (!firestore || !user || !plants || !parties) return;

        const fetchHistory = async () => {
            setIsLoadingHistory(true);
            try {
                const userDoc = await getDoc(doc(firestore, "users", user.uid));
                let authIds: string[] = [];
                const isRoot = isAdmin;

                if (userDoc.exists()) {
                    const data = userDoc.data() as SubUser;
                    authIds = (data.username === 'sikkaind' || isRoot) ? plants.map(p => p.id) : (data.accounts_plant_ids || []);
                } else if (isRoot) {
                    authIds = plants.map(p => p.id);
                }

                if (authIds.length === 0) {
                    setIsLoadingHistory(false);
                    return;
                }

                const allPayments: any[] = [];
                const invRef = collection(firestore, "invoices");
                // Simplified query to avoid mandatory index on nested payment status
                const q = query(invRef, where("plantId", "in", authIds.slice(0, 10)));
                const snap = await getDocs(q);

                snap.forEach(docSnap => {
                    const inv = docSnap.data() as Invoice;
                    if (!inv.payments || inv.payments.length === 0) return;

                    const consignor = plants.find(p => p.id === inv.consignorId);
                    const consignee = parties.find(p => p.id === inv.consigneeId);

                    inv.payments.forEach(p => {
                        allPayments.push({
                            ...p,
                            invoiceId: docSnap.id,
                            invoiceNo: inv.invoiceNo,
                            invoiceDate: inv.invoiceDate instanceof Timestamp ? inv.invoiceDate.toDate() : new Date(inv.invoiceDate),
                            plantId: inv.plantId,
                            plantName: consignor?.name || inv.plantId,
                            consignorName: consignor?.name || inv.consignorId,
                            consigneeName: consignee?.name || inv.consigneeId,
                            buyerName: consignee?.name || inv.consigneeId,
                            taxableAmount: inv.totals?.taxableAmount || (inv.totals as any)?.taxable || 0,
                            totalInvoiceAmount: inv.totals?.grandTotal || (inv.totals as any)?.grand || 0,
                            invoiceStatus: inv.paymentStatus,
                            paymentDate: p.paymentDate instanceof Timestamp ? p.paymentDate.toDate() : new Date(p.paymentDate)
                        });
                    });
                });

                setHistory(allPayments.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime()));
            } catch (e) {
                console.error("MIGO History Sync Error:", e);
            } finally {
                setIsLoadingHistory(false);
            }
        };

        fetchHistory();
    }, [firestore, user, plants, parties, dataVersion, isAdmin]);

    // Recycled Items Listener
    useEffect(() => {
        if (!firestore || !isAdmin) return;
        const q = query(collection(firestore, "recycle_bin"), where("data.type", "==", "InvoicePayment"));
        return onSnapshot(q, (snap) => {
            setRecycled(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    }, [firestore, isAdmin]);

    const handleDeletePayment = async (paymentId: string, invoiceId: string) => {
        if (!firestore || !user) return;
        showLoader();
        try {
            const invRef = doc(firestore, "invoices", invoiceId);
            const invSnap = await getDoc(invRef);
            if (!invSnap.exists()) {
                toast({ variant: 'destructive', title: "Registry Error", description: "Invoice document not found." });
                return;
            }

            const invData = invSnap.data() as Invoice;
            const paymentToRemove = invData.payments.find(p => p.id === paymentId);
            if (!paymentToRemove) return;

            const updatedPayments = invData.payments.filter(p => p.id !== paymentId);
            
            // Recalculate status based on registry aggregate
            const grandTotal = invData.totals?.grandTotal || (invData.totals as any)?.grand || 0;
            const totalPaidNew = updatedPayments.reduce((sum, p) => sum + (p.receiptAmount || 0) + (p.tdsAmount || 0), 0);
            const balanceNew = grandTotal - totalPaidNew;
            const statusNew = balanceNew <= 0.01 ? 'Paid' : (totalPaidNew > 0 ? 'Partly Paid' : 'Unpaid');

            const currentName = isAdmin ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);

            // 1. Update Invoice Node
            await updateDoc(invRef, {
                payments: updatedPayments,
                paymentStatus: statusNew,
                lastUpdatedAt: serverTimestamp(),
                updatedBy: currentName
            });

            // 2. Archive to Recycle Bin Registry
            await addDoc(collection(firestore, "recycle_bin"), {
                pageName: "Payment Receipt (MIGO)",
                userName: currentName,
                deletedAt: serverTimestamp(),
                data: { ...paymentToRemove, id: paymentId, invoiceId, invoiceNo: invData.invoiceNo, type: 'InvoicePayment' }
            });

            // 3. System Audit Log
            await addDoc(collection(firestore, "activity_logs"), {
                userId: user.uid,
                userName: currentName,
                action: 'Delete',
                tcode: 'MIGO',
                pageName: 'Payment History',
                timestamp: serverTimestamp(),
                description: `Revoked MIGO Payment ${paymentToRemove.migoNumber} for Invoice ${invData.invoiceNo}.`
            });

            toast({ title: 'Transaction Revoked', description: 'Payment node successfully archived in recycle bin.' });
            refreshData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
        } finally {
            hideLoader();
        }
    };

    const handleRestorePayment = async (itemId: string) => {
        if (!firestore || !user) return;
        showLoader();
        try {
            const itemRef = doc(firestore, "recycle_bin", itemId);
            const itemSnap = await getDoc(itemRef);
            if (!itemSnap.exists()) return;

            const { data: paymentData } = itemSnap.data();
            const invRef = doc(firestore, "invoices", paymentData.invoiceId);
            const invSnap = await getDoc(invRef);

            if (invSnap.exists()) {
                const inv = invSnap.data() as Invoice;
                const updatedPayments = [...(inv.payments || []), paymentData];
                
                const grandTotal = inv.totals?.grandTotal || (inv.totals as any)?.grand || 0;
                const totalPaidNew = updatedPayments.reduce((sum, p) => sum + (p.receiptAmount || 0) + (p.tdsAmount || 0), 0);
                const balanceNew = grandTotal - totalPaidNew;
                const statusNew = balanceNew <= 0.01 ? 'Paid' : (totalPaidNew > 0 ? 'Partly Paid' : 'Unpaid');

                await updateDoc(invRef, {
                    payments: updatedPayments,
                    paymentStatus: statusNew,
                    lastUpdatedAt: serverTimestamp()
                });
            }

            await deleteDoc(itemRef);
            toast({ title: 'Restoration Complete', description: 'Payment node returned to active registry.' });
            refreshData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Restore Error', description: e.message });
        } finally {
            hideLoader();
        }
    };

    const handlePermanentDelete = async (itemId: string) => {
        if (!firestore) return;
        showLoader();
        try {
            await deleteDoc(doc(firestore, "recycle_bin", itemId));
            toast({ title: 'Permanently Purged', description: 'Record scrubbed from mission registry.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Purge Failed', description: e.message });
        } finally {
            hideLoader();
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-10 animate-in fade-in duration-500">
            <PaymentReceiptForm 
                onFetch={() => {}} 
                onSave={() => {}} 
            />
            
            {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-40">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-900 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Syncing Payment Ledger...</p>
                </div>
            ) : (
                <PaymentHistory 
                    history={history}
                    recycled={recycled}
                    isAdmin={isAdmin}
                    onDelete={handleDeletePayment}
                    onRestore={handleRestorePayment}
                    onPermanentDelete={handlePermanentDelete}
                    refreshData={refreshData}
                />
            )}
        </div>
    );
}
