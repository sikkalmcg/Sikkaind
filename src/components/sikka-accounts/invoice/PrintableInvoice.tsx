
'use client';
import { format, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Timestamp } from 'firebase/firestore';

export default function PrintableInvoice({ invoice }: { invoice: any }) {
    const { consignor, consignee, items = [], totals, docColumns = [], itemColumns = [], docCustomValues = {} } = invoice;
    const shipTo = invoice.shipTo || consignee;
    const isCancelled = invoice.paymentStatus === 'Cancelled' || invoice.paymentStatus === 'Cancelled via Credit Note';

    const formatSafeDate = (date: any, pattern: string) => {
        if (!date) return null;
        try {
            const d = date instanceof Timestamp ? date.toDate() : new Date(date);
            return isValid(d) ? format(d, pattern) : null;
        } catch (e) {
            return null;
        }
    };

    // REGISTRY LOGIC: Filter Header Columns
    const showAckNo = invoice.ackNo && invoice.ackNo.toString().trim() !== '';
    const showAckDate = !!invoice.ackDate;
    const showIrn = invoice.irn && invoice.irn.toString().trim() !== '';
    const showBillMonth = invoice.billMonth && invoice.billMonth.toString().trim() !== '';
    const showChargeType = invoice.chargeType && invoice.chargeType.toString().trim() !== '';

    const visibleDocColumns = docColumns.filter((col: string) => {
        const val = docCustomValues?.[col];
        return val !== undefined && val !== null && val.toString().trim() !== '';
    });

    // REGISTRY LOGIC: Filter Item Grid Columns
    const showHsn = items.some((item: any) => (item.hsnSac || item.hsn || '').toString().trim() !== '');
    const showUom = items.some((item: any) => (item.uom || '').toString().trim() !== '');

    const visibleItemColumns = itemColumns.filter((col: string) => {
        return items.some((item: any) => {
            const val = item.itemCustomValues?.[col];
            return val !== undefined && val !== null && val.toString().trim() !== '';
        });
    });

    return (
        <div className="relative p-[10mm] bg-white text-black text-[9pt] leading-tight A4-page print:m-0 shadow-none border-none overflow-hidden font-sans min-h-[297mm]">
            
            {/* WATERMARK FOR CANCELLED DOCUMENTS */}
            {isCancelled && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.08] rotate-[-45deg]">
                    <span className="text-[120pt] font-black tracking-tighter uppercase border-[20pt] border-red-600 px-20 text-red-600">
                        CANCELLED
                    </span>
                </div>
            )}

            <div className="relative z-10 flex flex-col h-full">
                
                {/* 1. TOP HEADER - CONSIGNOR ON LEFT TOP */}
                <div className="grid grid-cols-3 items-start mb-6">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-4">
                            {consignor.logoUrl && consignor.logoUrl !== '/placeholder.svg' && (
                                <div className="shrink-0 border border-slate-100 p-1 bg-white shadow-sm">
                                    <img src={consignor.logoUrl} alt="Firm Logo" className="w-16 h-16 object-contain" />
                                </div>
                            )}
                            <div className="space-y-0.5">
                                <h1 className="text-[12pt] font-black uppercase leading-tight tracking-tight text-slate-900">{consignor.name}</h1>
                                <p className="text-[8pt] font-bold text-slate-600 leading-tight italic max-w-[220px]">{consignor.address}</p>
                            </div>
                        </div>
                        <div className="text-[8.5pt] font-black space-y-0.5 pl-1 border-l-2 border-slate-200">
                            <p className="flex justify-between w-48"><span className="text-slate-400 font-bold">GSTIN:</span> <span className="font-mono">{consignor.gstin || '--'}</span></p>
                            <p className="flex justify-between w-48"><span className="text-slate-400 font-bold">PAN:</span> <span className="font-mono">{consignor.pan || '--'}</span></p>
                            <p className="flex justify-between w-48"><span className="text-slate-400 font-bold">STATE:</span> <span>{consignor.state?.toUpperCase() || '--'} ({consignor.stateCode || '--'})</span></p>
                        </div>
                    </div>

                    <div className="text-center pt-4">
                        <h2 className="text-[18pt] font-black uppercase tracking-[0.15em] border-b-4 border-black inline-block pb-1 italic">
                            {invoice.invoiceType === 'Credit Note' ? 'CREDIT NOTE' : 'TAX INVOICE'}
                        </h2>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                        <div className="text-right">
                            <p className="text-[8pt] font-black text-slate-900 tracking-[0.3em]">ORIGINAL FOR RECIPIENT</p>
                        </div>
                        {invoice.qrCodeDataUrl && (
                            <div className="flex flex-col items-center">
                                <span className="text-[7pt] font-black uppercase tracking-[0.2em] text-slate-900 mb-1 leading-none italic">e-invoice</span>
                                <div className="border border-black p-1 bg-white shadow-md">
                                    <img src={invoice.qrCodeDataUrl} alt="Security QR" className="w-24 h-24 object-contain" />
                                </div>
                            </div>
                        )}
                        <Badge variant="outline" className="uppercase font-black text-[8px] tracking-widest border-slate-200 bg-slate-50 py-1">
                            Plant ID: {invoice.plantId}
                        </Badge>
                    </div>
                </div>

                {/* 2. DOCUMENT DETAILS SECTION - DYNAMIC FILTERING APPLIED */}
                <div className="border-2 border-black p-4 mb-6 bg-slate-50/50 rounded-xl">
                    <div className="grid grid-cols-4 gap-y-4 gap-x-8 text-[9pt]">
                        <div className="flex flex-col"><span className="text-[7pt] font-black uppercase text-slate-400 tracking-wider">Invoice Number</span><span className="font-black text-blue-900 text-[11pt] tracking-tighter">{invoice.invoiceNo}</span></div>
                        <div className="flex flex-col"><span className="text-[7pt] font-black uppercase text-slate-400 tracking-wider">Invoice Date</span><span className="font-bold">{formatSafeDate(invoice.invoiceDate, 'dd/MM/yyyy') || '--'}</span></div>
                        
                        {showChargeType && (
                            <div className="flex flex-col"><span className="text-[7pt] font-black uppercase text-slate-400 tracking-wider">Charge Type</span><span className="font-black uppercase text-slate-700">{invoice.chargeType}</span></div>
                        )}
                        
                        {showBillMonth && (
                            <div className="flex flex-col"><span className="text-[7pt] font-black uppercase text-slate-400 tracking-wider">Bill Month</span><span className="font-black uppercase">{invoice.billMonth}</span></div>
                        )}
                        
                        {showAckNo && (
                            <div className="flex flex-col"><span className="text-[7pt] font-black uppercase text-slate-400 tracking-wider">ACK No</span><span className="font-bold">{invoice.ackNo}</span></div>
                        )}
                        
                        {showAckDate && (
                            <div className="flex flex-col"><span className="text-[7pt] font-black uppercase text-slate-400 tracking-wider">ACK Date</span><span className="font-bold">{formatSafeDate(invoice.ackDate, 'dd/MM/yyyy')}</span></div>
                        )}
                        
                        {visibleDocColumns.map((col: string, idx: number) => (
                            <div key={idx} className="flex flex-col">
                                <span className="text-[7pt] font-black uppercase text-blue-600 tracking-wider">{col}</span>
                                <span className="font-bold uppercase truncate">{docCustomValues?.[col]}</span>
                            </div>
                        ))}

                        {showIrn && (
                            <div className="flex flex-col col-span-2 pt-2 border-t border-slate-200">
                                <span className="text-[7pt] font-black uppercase text-slate-400 tracking-wider">IRN Identifier</span>
                                <span className="font-mono text-[8pt] break-all leading-tight uppercase font-bold text-slate-800">
                                    {invoice.irn}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. PARTY REGISTRY SECTION */}
                <div className="border-2 border-black grid grid-cols-2 divide-x-2 divide-black mb-6 min-h-[140px] rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 space-y-3 bg-white">
                        <h3 className="font-black text-[8pt] uppercase tracking-[0.2em] text-slate-400 border-b pb-1">Consignee (Bill to)</h3>
                        <div className="space-y-1">
                            <p className="font-black text-[11pt] uppercase text-slate-900 tracking-tight">{consignee.name}</p>
                            <p className="text-[8.5pt] font-bold text-slate-600 leading-snug">{consignee.address}</p>
                            <div className="pt-2 text-[8.5pt] font-black space-y-1 border-t border-slate-50 mt-2">
                                <p className="flex justify-between w-56"><span>GSTIN:</span> <span className="font-mono text-blue-900">{consignee.gstin || '--'}</span></p>
                                <p className="font-black flex justify-between w-56"><span>PAN:</span> <span className="font-mono">{consignee.pan || '--'}</span></p>
                                <p className="font-black flex justify-between w-56"><span>STATE:</span> <span className="uppercase">{consignee.state || '--'} ({consignee.stateCode || '--'})</span></p>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 space-y-3 bg-slate-50/30">
                        <h3 className="font-black text-[8pt] uppercase tracking-[0.2em] text-slate-400 border-b pb-1">Ship to</h3>
                        <div className="space-y-1">
                            <p className="font-black text-[11pt] uppercase text-slate-900 tracking-tight">{shipTo.name}</p>
                            <p className="text-[8.5pt] font-bold text-slate-600 leading-snug">{shipTo.address}</p>
                            <div className="pt-2 text-[8.5pt] font-black space-y-1 border-t border-slate-50 mt-2">
                                <p className="flex justify-between w-56"><span>GSTIN:</span> <span className="font-mono text-blue-900">{shipTo.gstin || '--'}</span></p>
                                <p className="font-black flex justify-between w-56"><span>PAN:</span> <span className="font-mono">{shipTo.pan || '--'}</span></p>
                                <p className="font-black flex justify-between w-56"><span>STATE:</span> <span className="uppercase">{shipTo.state || '--'} ({shipTo.stateCode || '--'})</span></p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. ITEM MANIFEST GRID - DYNAMIC COLUMN SUPPRESSION */}
                <div className="flex-1">
                    <table className="w-full border-collapse border-2 border-black rounded-lg overflow-hidden">
                        <thead>
                            <tr className="bg-slate-900 text-white border-b-2 border-black h-10">
                                <th className="p-2 text-[8pt] font-black uppercase text-center w-10 border-r border-white/20">Sr</th>
                                <th className="p-2 text-[8pt] font-black uppercase text-left border-r border-white/20 px-4">Description of Goods</th>
                                
                                {visibleItemColumns.map((col: string, idx: number) => (
                                    <th key={idx} className="p-2 text-[8pt] font-black uppercase text-center border-r border-white/20 text-blue-400 italic px-2">{col}</th>
                                ))}
                                
                                {showHsn && (
                                    <th className="p-2 text-[8pt] font-black uppercase text-center w-24 border-r border-white/20">HSN/SAC</th>
                                )}
                                
                                <th className="p-2 text-[8pt] font-black uppercase text-center w-16 border-r border-white/20">QTY</th>
                                
                                {showUom && (
                                    <th className="p-2 text-[8pt] font-black uppercase text-center w-16 border-r border-white/20">UOM</th>
                                )}
                                
                                <th className="p-2 text-[8pt] font-black uppercase text-center w-24 border-r border-white/20">Rate</th>
                                <th className="p-2 text-[8pt] font-black uppercase text-right w-36 px-4">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item: any, idx: number) => (
                                <tr key={idx} className="border-b border-slate-200 h-11 hover:bg-slate-50 transition-colors">
                                    <td className="p-2 text-center border-r border-slate-200 font-black text-slate-300">{idx + 1}</td>
                                    <td className="p-2 font-black text-slate-800 border-r border-slate-200 uppercase px-4 text-[8.5pt]">{item.itemDescription || item.description}</td>
                                    
                                    {visibleItemColumns.map((col: string, cIdx: number) => (
                                        <td key={cIdx} className="p-2 text-center border-r border-slate-200 font-black text-blue-900/60 text-[8pt]">
                                            {item.itemCustomValues?.[col] || '--'}
                                        </td>
                                    ))}
                                    
                                    {showHsn && (
                                        <td className="p-2 text-center font-mono text-[8pt] border-r border-slate-200 font-bold">{item.hsnSac || item.hsn || '--'}</td>
                                    )}
                                    
                                    <td className="p-2 text-center font-black border-r border-slate-200">{item.qty || item.quantity}</td>
                                    
                                    {showUom && (
                                        <td className="p-2 text-center text-[8pt] font-black uppercase border-r border-slate-200 text-slate-500">{item.uom || 'MT'}</td>
                                    )}
                                    
                                    <td className="p-2 text-center font-bold text-slate-600 border-r border-slate-200">{Number(item.rate).toFixed(2)}</td>
                                    <td className="p-2 text-right font-black text-slate-900 px-4">
                                        {Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                            <tr className="h-12">
                                <td colSpan={2 + visibleItemColumns.length + (showHsn ? 1 : 0) + 1 + (showUom ? 1 : 0) + 1} className="border-r border-slate-200"></td>
                                <td className="border-l-2 border-black"></td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div className="flex justify-between items-start pt-6 gap-8">
                        {/* LEFT SIDE: AMOUNT IN WORDS - AUTO MERGE / WRAP WIDTH */}
                        <div className="flex-1 border-2 border-black p-4 rounded-xl self-stretch flex flex-col justify-center bg-slate-50/30">
                            <p className="text-[9pt] font-black leading-relaxed">
                                <span className="text-slate-400 uppercase text-[7.5pt] tracking-widest block mb-1">Total Amount in Words (RUPEES):</span>
                                <span className="italic text-slate-800 uppercase tracking-tight text-[10pt] leading-snug">
                                    "{totals.amountInWords || totals.words} ONLY"
                                </span>
                            </p>
                        </div>

                        {/* RIGHT SIDE: FINANCIAL SUMMARY */}
                        <div className="w-[380px] space-y-2.5 shrink-0">
                            <div className="flex justify-between items-center text-[9.5pt] px-2">
                                <span className="font-black uppercase text-slate-400 tracking-wider">Taxable Value</span>
                                <span className="font-black text-slate-900">₹ {Number(totals.taxableAmount || totals.taxable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            
                            {!totals.isInterState ? (
                                <>
                                    <div className="flex justify-between items-center text-[9pt] px-2">
                                        <span className="font-bold text-slate-500 italic">CGST @ {(invoice.gstRate || 12)/2}%</span>
                                        <span className="font-bold text-slate-700">{Number(totals.cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[9pt] px-2">
                                        <span className="font-bold text-slate-500 italic">SGST @ {(invoice.gstRate || 12)/2}%</span>
                                        <span className="font-bold text-slate-700">{Number(totals.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex justify-between items-center text-[9pt] px-2">
                                    <span className="font-bold text-slate-500 italic">IGST @ {invoice.gstRate || 12}%</span>
                                    <span className="font-bold text-slate-700">{Number(totals.igst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            
                            <div className="flex justify-between items-center text-[9pt] px-2 italic">
                                <span className="font-bold text-slate-400 uppercase text-[8pt]">Round Off</span>
                                <span className="font-bold text-slate-900">₹ {Number(totals.roundOff || 0).toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between items-center border-2 border-black py-4 mt-4 bg-transparent text-slate-900 rounded-xl px-6">
                                <span className="font-black text-[11pt] uppercase tracking-[0.2em]">Total Net Payable</span>
                                <span className="font-black text-[16pt] tracking-tighter text-blue-900">₹ {Number(totals.grandTotal || totals.grand).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-12 flex justify-end">
                    <div className="text-center w-80">
                        <div className="border-t border-dashed border-black w-full" />
                        <p className="font-black text-[10pt] uppercase tracking-[0.3em] text-slate-900 mt-1 italic leading-none">Authorized Signatory</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
