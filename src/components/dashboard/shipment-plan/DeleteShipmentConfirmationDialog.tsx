
'use client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { AlertTriangle, Ban, Package, MapPin, User, Truck } from "lucide-react";
import type { Shipment, WithId } from "@/types";
import { cn } from "@/lib/utils";

interface DeleteConfirmationDialogProps {
  children: React.ReactNode;
  onConfirm: () => void;
  shipment: WithId<Shipment>;
  disabled?: boolean;
}

export default function DeleteShipmentConfirmationDialog({ children, onConfirm, shipment, disabled }: DeleteConfirmationDialogProps) {
  const details = [
    { label: 'Order ID', value: shipment.shipmentId, icon: Package, mono: true },
    { label: 'Consignor', value: shipment.consignor, icon: User },
    { label: 'Consignee', value: shipment.billToParty, icon: User },
    { label: 'Destination', value: shipment.unloadingPoint, icon: MapPin },
    { label: 'Order Qty', value: `${shipment.quantity} ${shipment.materialTypeId}`, icon: Truck },
    { label: 'Balance to Revoke', value: `${shipment.balanceQty} ${shipment.materialTypeId}`, icon: Truck, highlight: true },
  ];

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild disabled={disabled}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-xl border-none shadow-2xl p-0 overflow-hidden bg-white">
        <AlertDialogHeader className="p-8 bg-red-50 border-b border-red-100 flex flex-row items-center gap-5 space-y-0">
          <div className="bg-red-600 p-3 rounded-2xl shadow-xl">
            <Ban className="h-8 w-8 text-white" />
          </div>
          <div>
            <AlertDialogTitle className="text-xl font-black text-red-900 uppercase tracking-tight">Revoke Sale Order?</AlertDialogTitle>
            <p className="text-red-700 font-bold uppercase text-[9px] tracking-widest mt-1">SIKKA LMC Registry Action Required</p>
          </div>
        </AlertDialogHeader>
        
        <div className="p-8 space-y-6">
            <p className="text-sm font-medium text-slate-600 leading-relaxed">
                Please verify the mission particulars below before confirming revocation. 
                This action is permanent and will be logged in the system audit registry.
            </p>

            <div className="grid grid-cols-2 gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                {details.map((item, i) => (
                    <div key={i} className={cn("space-y-1", item.highlight && "col-span-2 pt-3 border-t border-slate-200")}>
                        <div className="flex items-center gap-2 text-slate-400">
                            <item.icon className="h-3 w-3" />
                            <span className="text-[9px] font-black uppercase tracking-wider">{item.label}</span>
                        </div>
                        <p className={cn(
                            "text-sm font-bold text-slate-800 truncate",
                            item.mono && "font-mono tracking-tighter text-blue-700",
                            item.highlight && "text-red-600 text-lg font-black"
                        )}>
                            {item.value || '--'}
                        </p>
                    </div>
                ))}
            </div>
            
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3 shadow-inner">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-amber-800 leading-normal uppercase">
                    Warning: if this order was partially assigned, only the remaining balance of <span className="underline">{shipment.balanceQty} {shipment.materialTypeId}</span> will be revoked.
                </p>
            </div>
        </div>

        <AlertDialogFooter className="bg-slate-50 p-6 flex-row justify-end gap-3 border-t">
          <AlertDialogCancel className="font-bold border-slate-200 px-8 h-10 rounded-xl m-0">Abort</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-10 h-10 rounded-xl shadow-lg shadow-red-100 border-none transition-all active:scale-95"
          >
            Confirm Revoke
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
