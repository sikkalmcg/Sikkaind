
'use client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Truck, MapPin, User, ShieldCheck, Activity, Calendar, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TripDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
}

export default function TripDetailsDrawer({ isOpen, onClose, trip }: TripDetailsDrawerProps) {
  if (!trip) return null;

  const details = [
    { label: "Trip ID", value: trip.tripId, icon: ShieldCheck },
    { label: "Assigned Date", value: format(new Date(trip.startDate), 'PPpp'), icon: Calendar },
    { label: "Vehicle Number", value: trip.vehicleNumber, icon: Truck, highlight: true },
    { label: "Driver Name", value: trip.driverName, icon: User },
    { label: "Driver Contact", value: trip.driverMobile, icon: User },
    { label: "Carrier", value: trip.carrier, icon: ShieldCheck },
    { label: "Market Transporter", value: trip.transporterName || 'N/A', icon: Truck },
    { label: "Assigned weight", value: `${trip.assignedQtyInTrip} MT`, icon: Truck },
    { label: "Operational Status", value: trip.currentStatusId, icon: Activity },
    { label: "Drop Point", value: trip.unloadingPoint, icon: MapPin },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-xl overflow-y-auto bg-white border-l-4 border-l-blue-900">
        <SheetHeader className="pb-6 border-b">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-900 text-white rounded-lg"><Truck className="h-5 w-5" /></div>
            <SheetTitle className="text-2xl font-black text-blue-900 uppercase">Trip Lifecycle Details</SheetTitle>
          </div>
          <SheetDescription className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            System Trip Node: {trip.id}
          </SheetDescription>
        </SheetHeader>

        <div className="py-8 space-y-10">
            <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-600" /> Operational Particulars
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-8">
                    {details.map((d, i) => (
                        <div key={i} className={cn("space-y-1", d.highlight && "col-span-2 p-4 bg-slate-50 rounded-xl border border-slate-200")}>
                            <div className="flex items-center gap-2 text-slate-400 mb-1">
                                <d.icon className="h-3 w-3" />
                                <span className="text-[9px] font-black uppercase tracking-wider">{d.label}</span>
                            </div>
                            <p className={cn("text-sm font-bold text-slate-800", d.highlight && "text-blue-900 text-xl tracking-tighter")}>
                                {d.value || '--'}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <Separator className="bg-slate-100" />

            {/* LR SECTION */}
            {trip.lr && (
                <div className="p-6 rounded-2xl bg-blue-50/50 border border-blue-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-blue-900">
                            <FileText className="h-4 w-4" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest">Digital Lorry Receipt</h4>
                        </div>
                        <Badge className="bg-blue-600 font-black text-[9px] uppercase tracking-wider">VERIFIED</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <div><p className="text-blue-400 font-bold uppercase text-[9px] mb-1">LR Number</p><p className="font-bold text-blue-900">{trip.lr.lrNumber}</p></div>
                        <div><p className="text-blue-400 font-bold uppercase text-[9px] mb-1">LR Generation Date</p><p className="font-bold text-blue-900">{format(new Date(trip.lr.date), 'PP')}</p></div>
                        <div className="col-span-2 pt-4 border-t border-blue-100">
                            <Button variant="link" className="text-blue-700 h-auto p-0 font-black text-[10px] uppercase tracking-widest gap-2">
                                Open Full Preview <ExternalLink className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
