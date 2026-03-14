'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Loader2, FileText, WifiOff, Printer, FileDown } from 'lucide-react';
import { mockInvoices } from '@/lib/mock-data';
import type { WithId, Invoice } from '@/types';
import PrintableInvoice from '@/components/sikka-accounts/invoice/PrintableInvoice';
import React from 'react';
import { useFirestore } from "@/firebase";
import { collection, query, where, getDocs, limit, doc, getDoc, Timestamp } from "firebase/firestore";
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export type EnrichedInvoice = WithId<Invoice> & {
    consignor: any;
    consignee: any;
};

function PrintInvoicePage() {
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchQuery, setSearchTerm] = useState('');
  const [invoice, setInvoice] = useState<EnrichedInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dbError, setDbError] = useState(false);

  const handleSearch = async (queryVal?: string) => {
    const term = (queryVal || searchQuery).trim();
    if (!term || !firestore) return;

    setIsLoading(true);
    setInvoice(null);
    setDbError(false);

    try {
        const q = query(collection(firestore, "invoices"), where("invoiceNo", "==", term), limit(1));
        const snap = await getDocs(q);

        if (snap.empty) {
            const mock = mockInvoices.find(i => i.invoiceNo === term);
            if (mock) {
                setInvoice({
                    ...mock,
                    consignor: { name: 'Sikka Enterprises', address: 'Ghaziabad, UP', gstin: '09AABCU9567L1Z1' },
                    consignee: { name: mock.consigneeId, address: 'N/A' }
                } as any); 
            } else {
                toast({ variant: 'destructive', title: "Not Found", description: `Invoice ${term} not found in registry.` });
            }
        } else {
            const docData = snap.docs[0].data();
            
            const invData = { 
                id: snap.docs[0].id, 
                ...docData,
                invoiceDate: docData.invoiceDate instanceof Timestamp ? docData.invoiceDate.toDate() : new Date(docData.invoiceDate),
                ackDate: docData.ackDate instanceof Timestamp ? docData.ackDate.toDate() : (docData.ackDate ? new Date(docData.ackDate) : undefined),
                irnGeneratedAt: docData.irnGeneratedAt instanceof Timestamp ? docData.irnGeneratedAt.toDate() : (docData.irnGeneratedAt ? new Date(docData.irnGeneratedAt) : undefined),
            } as WithId<Invoice>;
            
            const [consignorSnap, consigneeSnap, chargeTypeSnap] = await Promise.all([
                getDoc(doc(firestore, "accounts_plants", invData.plantId)),
                getDoc(doc(firestore, "parties", invData.consigneeId)),
                getDoc(doc(firestore, "master_charge_types", invData.chargeType))
            ]);

            const enriched = {
                ...invData,
                consignor: consignorSnap.exists() ? consignorSnap.data() : { name: invData.plantId, address: 'Node Registry Pending' },
                consignee: consigneeSnap.exists() ? consigneeSnap.data() : { name: invData.consigneeId, address: 'Party Registry Pending' },
                chargeType: chargeTypeSnap.exists() ? chargeTypeSnap.data().name : invData.chargeType
            };

            setInvoice(enriched as EnrichedInvoice);
        }
    } catch (e) {
        console.error("Registry Sync Error:", e);
        setDbError(true);
    } finally {
        setIsLoading(false);
    }
  };

  const handleDownloadPdf = useCallback(() => {
    if (!invoice) return;
    
    // Mission Logic: Set specific title for PDF filename recognition
    const originalTitle = document.title;
    document.title = `Invoice_${invoice.invoiceNo}`;
    
    // Direct Execution Node
    setTimeout(() => {
        window.print();
        // Restore context
        setTimeout(() => {
            document.title = originalTitle;
        }, 1000);
    }, 50);
    
    toast({
        title: "Download Initiated",
        description: "Registry document extraction sent to print node."
    });
  }, [invoice, toast]);

  useEffect(() => {
    const no = searchParams.get('invoiceNo');
    if (no && firestore) {
      setSearchTerm(no);
      handleSearch(no);
    }
  }, [searchParams, firestore]);

  return (
    <div className="p-8 space-y-8 max-w-[1200px] mx-auto print:p-0">
      <div className="flex items-end gap-4 pb-8 border-b print:hidden">
        <div className="grid gap-2">
          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Billing Document Node</Label>
          <Input
            placeholder="Enter Invoice No..."
            value={searchQuery}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-80 h-12 rounded-2xl bg-white border-slate-200 font-black text-blue-900 shadow-sm focus-visible:ring-blue-900"
          />
        </div>
        <Button onClick={() => handleSearch()} disabled={isLoading} className="h-12 px-8 rounded-2xl bg-blue-900 hover:bg-slate-900 shadow-xl border-none transition-all active:scale-95">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Display Document
        </Button>
        {dbError && <WifiOff className="h-5 w-5 text-orange-500 mb-3" />}
      </div>

      <div className="flex-1">
        {invoice ? (
          <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-500 relative">
             <div className="p-4 bg-slate-50 border-b flex justify-end gap-2 print:hidden">
                <Button variant="ghost" onClick={() => window.print()} className="font-bold text-xs uppercase tracking-tight hover:bg-white text-slate-600">
                    <Printer className="h-4 w-4 mr-2"/> Print Document
                </Button>
                <Button variant="ghost" onClick={handleDownloadPdf} className="font-bold text-xs uppercase tracking-tight text-blue-600 hover:bg-blue-50">
                    <FileDown className="h-4 w-4 mr-2"/> Download PDF
                </Button>
             </div>
             <PrintableInvoice invoice={invoice} />
          </div>
        ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-blue-900" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Syncing Master Registry...</p>
            </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 opacity-20 group">
            <FileText className="h-20 w-20 mb-4 transition-transform duration-500 group-hover:scale-110" />
            <p className="text-xl font-black uppercase tracking-tighter">Awaiting Document Node Identifier</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PrintInvoicePageWrapper() {
  return (
    <React.Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <PrintInvoicePage />
    </React.Suspense>
  );
}
