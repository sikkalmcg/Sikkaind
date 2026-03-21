'use client';
import { format } from 'date-fns';
import type { WithId, LR, Carrier, Trip, Shipment, Plant } from '@/types';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { useMemo } from 'react';

export type EnrichedLR = WithId<LR> & {
    trip?: WithId<Trip>;
    carrier?: WithId<Carrier>;
    shipment?: WithId<Shipment>;
    plant?: WithId<Plant>;
};

/**
 * Registry Logic: Extract City Node
 * Parses an address string to isolate the city name for mission manifest printing.
 * Handles common Indian address formats (City, State PIN).
 */
const getCityOnly = (address: string): string => {
    if (!address || address === 'N/A') return 'N/A';
    
    // 1. Remove PIN code (6 digits)
    let clean = address.replace(/\b\d{6}\b/g, '').trim();
    
    // 2. Split by comma
    let parts = clean.split(',').map(p => p.trim()).filter(Boolean);
    
    if (parts.length === 0) return address.toUpperCase();

    // 3. Identification of common state nodes to find preceding city
    const states = [
        'UTTAR PRADESH', 'DELHI', 'HARYANA', 'MAHARASHTRA', 'WEST BENGAL', 'TAMIL NADU', 
        'KARNATAKA', 'GUJARAT', 'RAJASTHAN', 'PUNJAB', 'BIHAR', 'MADHYA PRADESH', 
        'ANDHRA PRADESH', 'TELANGANA', 'KERALA', 'ODISHA', 'ASSAM', 'UP', 'HR', 'MH', 'WB', 'INDIA'
    ];
    
    let lastPart = parts[parts.length - 1].toUpperCase();
    const isState = states.some(s => lastPart === s || lastPart.startsWith(s + " "));
    
    if (isState && parts.length >= 2) {
        // Registry Pulse: If last node is a state, city is the previous node
        return parts[parts.length - 2].toUpperCase();
    }
    
    return lastPart.toUpperCase();
};

export default function PrintableLR({ 
    lr, 
    copyType = "Preview",
    pageNumber,
    totalInSeries
}: { 
    lr: EnrichedLR, 
    copyType?: string,
    pageNumber?: number,
    totalInSeries?: number
}) {
  const carrier = lr.carrier || {} as Carrier;
  const trip = lr.trip || {} as Trip;
  const shipment = lr.shipment || {} as Shipment;
  const plant = lr.plant || {} as Plant;
  const items = lr.items || [];

  const totalUnits = items.reduce((sum, item) => sum + (Number(item.units) || 0), 0);
  
  const isActualWeightMode = lr.weightSelection === 'Actual Weight';
  const totalWeight = isActualWeightMode 
    ? items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0)
    : (Number(lr.assignedTripWeight) || 0);

  const totalWeightDisplay = `${Number(totalWeight || 0).toFixed(3)} MT`;

  // Registry Extraction: Isolate City Nodes for Origin and Destination
  // Logic Fix: Origin strictly uses Plant Address City to avoid showing Consignor Name
  const originCity = useMemo(() => {
    const address = (plant && plant.address && plant.address !== 'N/A') 
        ? plant.address 
        : (shipment.loadingPoint || lr.from || '');
    return getCityOnly(address);
  }, [plant, shipment.loadingPoint, lr.from]);

  const destCity = useMemo(() => getCityOnly(lr.to || shipment.unloadingPoint || ''), [lr.to, shipment.unloadingPoint]);

  const displayVehicleNo = (trip.vehicleNumber && trip.vehicleNumber.trim() !== "") ? trip.vehicleNumber.toUpperCase() : "";
  const displayTripId = (displayVehicleNo && displayVehicleNo !== "") ? (trip?.tripId || lr.tripId) : "";
  const displayPilotMobile = trip.driverMobile || "";

  const displayConsignorGtin = lr.consignorGtin || shipment.consignorGtin || 'N/A';
  const displayConsignorMobile = lr.consignorMobile || 'N/A';

  const displayBuyerGtin = lr.buyerGtin || shipment.billToGtin || 'N/A';
  const displayBuyerMobile = lr.buyerMobile || 'N/A';

  const displayShipToGtin = lr.shipToGtin || shipment.shipToGtin || displayBuyerGtin || 'N/A';
  const displayShipToMobile = lr.shipToMobile || displayBuyerMobile || 'N/A';

  const resolvedState = useMemo(() => {
    const sName = carrier.stateName;
    const sCode = carrier.stateCode;
    const gstin = carrier.gstin;
    
    if (sName && sCode) return { name: sName, code: sCode };
    if (gstin && gstin.length >= 2) {
        const code = gstin.substring(0, 2);
        return { name: '--', code: code };
    }
    return { name: '--', code: '--' };
  }, [carrier]);

  const resolvedPan = useMemo(() => {
    if (carrier.pan) return carrier.pan;
    const gstin = carrier.gstin;
    if (gstin && gstin.length >= 12) {
        return gstin.substring(2, 12).toUpperCase();
    }
    return '--';
  }, [carrier]);

  return (
    <div className="bg-white text-black font-sans text-[9pt] leading-tight A4-page print:m-0 shadow-none border-none overflow-hidden h-[297mm] w-[210mm] flex flex-col box-border">
        <div className="flex flex-col flex-1 h-full">
            
            <div className="flex justify-between items-start pb-3 border-b-2 border-black">
                <div className="flex items-start gap-4 max-w-[65%]">
                    {carrier.logoUrl && carrier.logoUrl !== '/placeholder.svg' && (
                        <div className="shrink-0 border border-black p-1 bg-white shadow-sm">
                            <img src={carrier.logoUrl} alt="Carrier Logo" width="56" height="56" className="object-contain" />
                        </div>
                    )}
                    <div className="space-y-0.5">
                        <h1 className="font-black text-lg uppercase leading-none tracking-tight text-black">{carrier.name || ''}</h1>
                        <p className="text-[7.5pt] leading-tight text-black">{carrier.address || ''}</p>
                        
                        <div className="flex gap-4 text-[8pt] font-black mt-1 text-black">
                            <p>GSTIN: {carrier.gstin || ''}</p>
                            <p>PAN: {resolvedPan === '--' ? '' : resolvedPan}</p>
                        </div>
                        
                        <div className="flex gap-4 text-[7.5pt] font-medium text-black">
                            <p><span className="font-black">STATE:</span> {resolvedState.name === '--' ? '' : resolvedState.name} ({resolvedState.code === '--' ? '' : resolvedState.code})</p>
                            {carrier.website && <p><span className="font-black">WEB:</span> {carrier.website}</p>}
                        </div>

                        <p className="text-[7.5pt] font-medium text-black">{carrier.mobile ? `Contact: ${carrier.mobile}` : ''} {carrier.email ? `| ${carrier.email}` : ''}</p>
                    </div>
                </div>

                <div className="text-right space-y-1">
                    <div className="inline-block border-2 border-black px-3 py-1 mb-1.5 bg-white">
                        <span className="font-black text-[10pt] uppercase tracking-widest text-black">{copyType}</span>
                    </div>
                    <div className="text-[8.5pt] space-y-0.5 text-black">
                        <p className="font-black text-base">LR No: {lr.lrNumber || 'N/A'}</p>
                        <p className="font-bold">Date: <span>{lr.date ? format(new Date(lr.date instanceof Timestamp ? lr.date.toDate() : lr.date), 'dd-MMM-yyyy') : 'N/A'}</span></p>
                        <p className="text-[7.5pt]"><span className="font-bold uppercase text-[7pt] text-black mr-1">ORIGIN:</span> {originCity}</p>
                        <p className="text-[7.5pt]"><span className="font-bold uppercase text-[7pt] text-black mr-1">DESTINATION:</span> {destCity}</p>
                    </div>
                </div>
            </div>

            <div className="mt-3">
                <table className="w-full border-collapse border border-black">
                    <thead>
                        <tr className="bg-white">
                            <th className="border-r border-black p-1 text-[7.5pt] font-black uppercase w-1/4 text-center text-black">Vehicle Number</th>
                            <th className="border-r border-black p-1 text-[7.5pt] font-black uppercase w-1/4 text-center text-black">Driver Mobile</th>
                            <th className="border-r border-black p-1 text-[7.5pt] font-black uppercase w-1/4 text-center text-black">Payment Term</th>
                            <th className="p-1 text-[7.5pt] font-black uppercase w-1/4 text-center text-black">Trip Reference</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-t border-black">
                            <td className="border-r border-black p-1.5 text-center font-black text-base tracking-tighter text-black">{displayVehicleNo}</td>
                            <td className="border-r border-black p-1.5 text-center font-bold font-mono text-[9pt] text-black">{displayPilotMobile}</td>
                            <td className="border-r border-black p-1.5 text-center font-black uppercase text-[9pt] text-black">{lr.paymentTerm || ''}</td>
                            <td className="p-1.5 text-center text-[8.5pt] font-bold font-mono text-black">{displayTripId}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="grid grid-cols-3 border-x border-b border-black text-[8.5pt]">
                <div className="p-2.5 border-r border-black space-y-1">
                    <span className="text-[6.5pt] font-black uppercase text-black block">Consignor (FROM)</span>
                    <p className="font-black leading-tight uppercase text-black">{lr.consignorName || 'N/A'}</p>
                    <div className="flex flex-col gap-0.5 mt-1">
                        <p className="font-mono text-[7.5pt] text-black">GSTIN: {displayConsignorGtin}</p>
                        <p className="font-mono text-[7.5pt] text-black">Mob: {displayConsignorMobile}</p>
                    </div>
                </div>
                <div className="p-2.5 border-r border-black space-y-1">
                    <span className="text-[6.5pt] font-black uppercase text-black block">Consignee (BILL TO)</span>
                    <p className="font-black leading-tight uppercase text-black">{lr.buyerName || 'N/A'}</p>
                    <div className="flex flex-col gap-0.5 mt-1">
                        <p className="font-mono text-[7.5pt] text-black">GSTIN: {displayBuyerGtin}</p>
                        <p className="font-mono text-[7.5pt] text-black">Mob: {displayBuyerMobile}</p>
                    </div>
                </div>
                <div className="p-2.5 space-y-1 bg-white">
                    <span className="text-[6.5pt] font-black uppercase text-black block">SHIP TO (DROP POINT)</span>
                    <p className="font-black leading-tight uppercase text-black">{lr.shipToParty || 'N/A'}</p>
                    <div className="flex flex-col gap-0.5 mt-1">
                        <p className="font-mono text-[7.5pt] text-black">GSTIN: {displayShipToGtin}</p>
                        <p className="font-mono text-[7.5pt] text-black">Mob: {displayShipToMobile}</p>
                    </div>
                </div>
            </div>

            <div className="border-x border-b border-black p-2 bg-white text-[8.5pt]">
                <span className="text-[6.5pt] font-black uppercase text-black block mb-0.5">Delivery Address</span>
                <p className="font-bold leading-snug whitespace-pre-line italic text-black">"{lr.deliveryAddress || 'N/A'}"</p>
            </div>

            <div className="mt-4">
                <table className="w-full border-collapse border-2 border-black">
                    <thead>
                        <tr className="bg-white text-black border-b-2 border-black">
                            <th className="border-r border-black p-1.5 text-[7.5pt] font-black uppercase text-left w-[15%]">Invoice No</th>
                            <th className="border-r border-black p-1.5 text-[7.5pt] font-black uppercase text-left w-[15%]">E-Waybill</th>
                            <th className="border-r border-black p-1.5 text-[7.5pt] font-black uppercase text-center w-[10%]">Package</th>
                            <th className="border-r border-black p-1.5 text-[7.5pt] font-black uppercase text-left w-[45%]">Item Description</th>
                            <th className="p-1.5 text-[7.5pt] font-black uppercase text-right w-[15%]">Weight</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length > 0 ? (
                            items.map((item, idx) => (
                                <tr key={idx} className="border-b border-black last:border-b-0 h-9">
                                    <td className="border-r border-black p-1.5 text-[8.5pt] font-bold text-black">{item.invoiceNumber || '--'}</td>
                                    <td className="border-r border-black p-1.5 text-[7.5pt] font-mono text-black">{item.ewaybillNumber || '--'}</td>
                                    <td className="border-r border-black p-1.5 text-center text-[8.5pt] font-bold text-black">{item.units}</td>
                                    <td className="border-r border-black p-1.5 text-[8.5pt] leading-tight uppercase font-medium text-black">{item.itemDescription || item.productDescription || 'N/A'}</td>
                                    <td className="p-1.5 text-right text-[8.5pt] font-black text-black">{Number(item.weight || 0).toFixed(3)}</td>
                                </tr>
                            ))
                        ) : (
                            <tr className="h-16">
                                <td colSpan={2} className="border-r border-black p-3 text-[8.5pt] font-bold italic text-black">Items Consolidated as per Mission Registry</td>
                                <td className="border-r border-black text-center font-black text-black">---</td>
                                <td className="border-r border-black p-3 text-[8.5pt] font-black uppercase text-black">{shipment.material || 'Consolidated Cargo'}</td>
                                <td className="p-3 text-right font-black text-black text-[10pt]">{Number(lr.assignedTripWeight || 0).toFixed(3)}</td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="bg-white border-t-2 border-black font-black text-[9pt]">
                            <td className="p-1.5 text-right uppercase tracking-wider text-black border-r border-black" colSpan={2}>Grand Totals:</td>
                            <td className="border-r border-black p-1.5 text-center text-black">{totalUnits}</td>
                            <td className="border-r border-black p-1.5"></td>
                            <td className="p-1.5 text-right text-black text-[10pt]">{totalWeightDisplay}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="mt-4 border-2 border-black p-0 overflow-hidden rounded-lg">
                <div className="bg-white text-black border-b-2 border-black p-1.5 px-3">
                    <span className="text-[8pt] font-black uppercase tracking-widest">CUSTOMER ACKNOWLEDGEMENT REGISTRY</span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-12 bg-white">
                    <div className="text-[8.5pt] space-y-2">
                        <p className="font-black uppercase text-[6.5pt] text-black opacity-50">Receiver Stamp & Authentication</p>
                        <div className="h-16 border-b border-dashed border-black/30"></div>
                    </div>
                    <div className="flex flex-col items-end justify-end">
                        <p className="text-[7.5pt] text-black opacity-40 italic font-medium">Electronic verification code applicable</p>
                    </div>
                </div>
            </div>

            <div className="mt-auto flex flex-col gap-4">
                <div className="space-y-1.5 px-1">
                    <h4 className="text-[7.5pt] font-black uppercase underline tracking-wider text-black">LIFTING NODE TERMS & CONDITIONS</h4>
                    <div className="grid grid-cols-2 gap-10 text-[6.5pt] leading-tight text-justify text-black">
                        <div className="space-y-0.5">
                            <p>1. Agency is not responsible for rain or any natural calamity.</p>
                            <p>2. Any discrepancy regarding material has to be intimated within 24 Hours of the receipt material with remark in POD section.</p>
                            <p>3. Owner of the vehicle (truck) is responsible for the goods after lifting the goods.</p>
                        </div>
                        <div className="space-y-0.5">
                            <p>4. Agency has the right to hold the material upon shortage of vehicle.</p>
                            <p>5. Traders is responsible for contraband goods or goods which are not authorized.</p>
                            <p>6. Agency holds no responsibility after goods have been delivered.</p>
                            <p>7. All disputes subject to Ghaziabad Jurisdiction.</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex justify-end">
                        <div className="text-center w-56 space-y-1.5">
                            <div className="h-6 flex items-end justify-center">
                                <div className="w-full border-b-2 border-black border-dashed"></div>
                            </div>
                            <p className="font-black text-[8.5pt] uppercase tracking-widest leading-none text-black">Authorized Signatory</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-center text-center gap-0.5">
                        <p className="text-[7pt] font-bold italic text-black opacity-60 tracking-tighter">
                            "Note: This Lorry Receipt was generated digitally and is to be considered as original"
                        </p>
                        {pageNumber && totalInSeries && (
                            <p className="text-[6.5pt] font-black uppercase text-black opacity-40 tracking-widest">
                                Page {pageNumber} of {totalInSeries}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}