
'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, ShieldCheck, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc, Timestamp } from 'firebase/firestore';
import PaymentAcceptanceModal from './PaymentAcceptanceModal';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';

interface PaymentReceiptFormProps {
  onFetch: (invoiceNo: string) => void;
  onSave: (invoiceId: string, paymentData: any) => void;
}

export default function PaymentReceiptForm({ onFetch, onSave }: PaymentReceiptFormProps) {
  const [invoice, setInvoice] = useState<any>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAcceptanceModalOpen, setIsAcceptanceModalOpen] = useState(false);
  
  const firestore = useFirestore();
  const { user } = useUser();
  const { setExecuteAction, setStatusBar } = useSikkaAccountsPage();

  const handleFetch = async () => {
    if (!searchTerm || !firestore) return;
    setIsFetching(true);
    setInvoice(null);
    try {
        const q = query(collection(firestore, "invoices"), where("invoiceNo", "==", searchTerm.trim()), limit(1));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            setStatusBar({ message: `Invoice ${searchTerm} not found in registry.`, type: 'error' });
        } else {
            const data = snap.docs[0].data();
            
            // IRN Compliance Check: MIGO is blocked if IRN is missing
            if (!data.irn?.trim()) {
                setStatusBar({ 
                    message: `IRN Pending - Payment receipt blocked for Invoice ${searchTerm}. Update registry in VF02 first.`, 
                    type: 'error' 
                });
                setIsFetching(false);
                return;
            }

            const inv = { 
                id: snap.docs[0].id, 
                ...data,
                invoiceDate: data.invoiceDate instanceof Timestamp ? data.invoiceDate.toDate() : new Date(data.invoiceDate)
            };
            
            const [consignorSnap, consigneeSnap, chargeTypeSnap] = await Promise.all([
                getDoc(doc(firestore, "accounts_plants", inv.plantId)),
                getDoc(doc(firestore, "parties", inv.consigneeId)),
                getDoc(doc(firestore, "master_charge_types", inv.chargeType))
            ]);

            const enriched = {
                ...inv,
                consignorName: consignorSnap.exists() ? consignorSnap.data().name : inv.plantId,
                consigneeName: consigneeSnap.exists() ? consigneeSnap.data().name : inv.consigneeId,
                chargeTypeName: chargeTypeSnap.exists() ? chargeTypeSnap.data().name : inv.chargeType
            };

            setInvoice(enriched);
            setStatusBar({ message: `Invoice ${inv.invoiceNo} successfully resolved.`, type: 'success' });
        }
    } catch (e: any) {
        setStatusBar({ message: e.message, type: 'error' });
    } finally {
        setIsFetching(false);
    }
  };

  const handleExecute = useCallback(() => {
    if (!invoice) {
        setStatusBar({ message: "Search and resolve an invoice node first.", type: 'warning' });
        return;
    }
    setIsAcceptanceModalOpen(true);
  }, [invoice, setStatusBar]);

  useEffect(() => {
    setExecuteAction(() => handleExecute);
    return () => setExecuteAction(null);
  }, [handleExecute, setExecuteAction]);

  const grandTotalResolved = invoice?.totals?.grandTotal ?? invoice?.totals?.grand ?? 0;

  return (
    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
      <CardHeader className="bg-slate-50 border-b p-8">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                    <ShieldCheck className="h-8 w-8" />
                </div>
                <div>
                    <CardTitle className="text-2xl font-black uppercase text-slate-800 italic">MIGO – Payment Acceptance Registry</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Lifting Node Liability Liquidation Module</CardDescription>
                </div>
            </div>
            
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button 
                            onClick={handleExecute} 
                            disabled={!invoice || isFetching}
                            className={cn(
                                "h-16 w-16 rounded-2xl bg-white border-2 border-slate-200 hover:border-blue-600 shadow-xl transition-all active:scale-95 flex items-center justify-center group overflow-hidden",
                                (!invoice || isFetching) && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            {isFetching ? (
                                <Loader2 className="h-8 w-8 animate-spin text-blue-900"/>
                            ) : (
                                <img 
                                    src="https://c8.alamy.com/comp/T6WNK3/real-time-icon-in-transparent-style-clock-vector-illustration-on-isolated-background-watch-business-concept-T6WNK3.jpg" 
                                    alt="Execute" 
                                    className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                                />
                            )}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-slate-900 text-white font-black uppercase text-[10px] border-none shadow-xl px-4 py-2">
                        Execute Acceptance (F8)
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="p-10">
        <div className="flex items-end gap-4 max-w-md p-6 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner">
            <div className="grid w-full items-center gap-2">
                <Label htmlFor="search-invoice" className="text-[10px] font-black uppercase text-slate-400 px-1">Lookup Invoice Node *</Label>
                <Input 
                    id="search-invoice" 
                    placeholder="Enter Invoice #"
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleFetch()} 
                    className="h-12 rounded-xl font-black text-blue-900 shadow-sm focus-visible:ring-blue-900"
                />
            </div>
            <Button onClick={handleFetch} disabled={isFetching || !searchTerm} className="h-12 w-12 rounded-xl bg-blue-900 hover:bg-slate-900 shrink-0">
                {isFetching ? <Loader2 className="h-5 w-5 animate-spin"/> : <Search className="h-5 w-5" />}
            </Button>
        </div>
        
        {invoice && (
            <div className="mt-10 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-8 p-8 bg-blue-50/30 rounded-[2rem] border border-blue-100 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Date</p><p className="text-sm font-bold text-slate-800">{format(invoice.invoiceDate, 'dd/MM/yyyy')}</p></div>
                <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Plant Node</p><p className="text-sm font-black text-blue-900">{invoice.plantId}</p></div>
                <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Consignor</p><p className="text-sm font-bold text-slate-800 truncate">{invoice.consignorName}</p></div>
                <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Consignee</p><p className="text-sm font-bold text-slate-800 truncate">{invoice.consigneeName}</p></div>
                <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Charge Type</p><p className="text-[11px] font-black text-slate-700 uppercase italic truncate">{invoice.chargeTypeName || invoice.chargeType}</p></div>
                <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Total Net Payable amount</p><p className="text-sm font-black text-blue-900">₹ {grandTotalResolved.toLocaleString()}</p></div>
                
                <div className="col-span-full flex items-center gap-4 bg-emerald-50 p-4 rounded-xl border border-emerald-100 mt-2">
                    <ShieldCheck className="h-6 w-6 text-emerald-600" />
                    <div>
                        <p className="text-[10px] font-black text-emerald-800 uppercase">Registry Status: {invoice.paymentStatus}</p>
                        <p className="text-[9px] font-bold text-emerald-600 uppercase">Ready for liquidation handshake</p>
                    </div>
                </div>
            </div>
        )}

        {isAcceptanceModalOpen && invoice && (
            <PaymentAcceptanceModal 
                isOpen={isAcceptanceModalOpen}
                onClose={() => setIsAcceptanceModalOpen(false)}
                invoice={invoice}
                onSuccess={() => {
                    setIsAcceptanceModalOpen(false);
                    setInvoice(null);
                    setSearchTerm('');
                }}
            />
        )}
      </CardContent>
    </Card>
  );
}
