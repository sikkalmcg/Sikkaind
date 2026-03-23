'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/date-picker';
import { Textarea } from '@/components/ui/textarea';
import type { Plant, Shipment, WithId, SubUser, Party, MasterQtyType, Carrier } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  ShieldCheck, 
  Factory, 
  AlertTriangle, 
  User, 
  MapPin, 
  Search, 
  CheckCircle2, 
  X, 
  ChevronRight, 
  Globe, 
  AlertCircle, 
  Sparkles, 
  Save, 
  Calculator, 
  Package, 
  FileDown, 
  Upload, 
  FileText,
  Truck,
  UserCircle,
  PlusCircle,
  Plus,
  History,
  ListTree,
  Trash2
} from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, doc, runTransaction, where, getDocs, limit, serverTimestamp, orderBy, getDoc, writeBatch } from "firebase/firestore";
import { cn, normalizePlantId, formatSequenceId, generateRandomTripId, incrementSerial } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import * as XLSX from 'xlsx';
import { PaymentTerms } from '@/lib/constants';

interface CreatePlanProps {
  onShipmentCreated: (shipment: WithId<Shipment>) => void;
}

const itemSchema = z.object({
    invoiceNumber: z.string().min(1, "Doc ref required."),
    ewaybillNumber: z.string().optional(),
    itemDescription: z.string().min(1, "Item description is mandatory."),
    units: z.coerce.number().min(1, "Qty required."),
    weight: z.coerce.number().optional().default(0),
});

const formSchema = z.object({
  originPlantId: z.string().min(1, 'Plant node selection is required.'),
  consignor: z.string().min(1, 'Consignor is mandatory.'),
  consignorGtin: z.string().optional(),
  loadingPoint: z.string().min(1, 'Lifting node address is required.'),
  billToParty: z.string().min(1, 'Consignee is mandatory.'),
  billToGtin: z.string().optional(),
  isSameAsBillTo: z.boolean().default(false),
  shipToParty: z.string().optional(),
  shipToGtin: z.string().optional(),
  unloadingPoint: z.string().min(1, 'Destination address is mandatory.'),
  quantity: z.coerce.number().optional().default(0),
  materialTypeId: z.string().min(1, 'UOM is required.'),
  // Optional LR Fields
  lrNumber: z.string().optional().or(z.literal('')),
  lrDate: z.date().optional().nullable(),
  carrierId: z.string().optional().or(z.literal('')),
  paymentTerm: z.enum(PaymentTerms).optional(),
  items: z.array(itemSchema).optional().default([]),
  deliveryAddress: z.string().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
    if (data.materialTypeId !== 'FTL') {
        if (!data.quantity || data.quantity <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Numeric quantity is mandatory for selected UOM.',
                path: ['quantity']
            });
        }
    }
    // Mandatory LR Fields if LR Number provided
    if (data.lrNumber?.trim()) {
        if (!data.lrDate) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'LR Date mandatory.', path: ['lrDate'] });
        }
        if (!data.carrierId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Carrier mandatory.', path: ['carrierId'] });
        }
        if (!data.paymentTerm) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Payment Term mandatory.', path: ['paymentTerm'] });
        }
        if (!data.items || data.items.length === 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Item Description manifest required for LR.', path: ['items'] });
        }
        if (!data.deliveryAddress?.trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Delivery Address required for LR.', path: ['deliveryAddress'] });
        }
    }
});

type FormValues = z.infer<typeof formSchema>;

export default function CreatePlan({ onShipmentCreated }: CreatePlanProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const [authorizedPlants, setAuthorizedPlants] = useState<WithId<Plant>[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [helpModal, setHelpModal] = useState<{ type: 'consignor' | 'billToParty' | 'shipToParty'; title: string; data: any[] } | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, 
    [firestore]
  );
  const { data: allPlants, isLoading: isLoadingPlants } = useCollection<Plant>(plantsQuery);

  const carriersQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "carriers")) : null, 
    [firestore]
  );
  const { data: carriers } = useCollection<Carrier>(carriersQuery);

  const qtyTypesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "material_types")) : null, 
    [firestore]
  );
  const { data: qtyTypes } = useCollection<MasterQtyType>(qtyTypesQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
        originPlantId: '', 
        consignor: '', 
        consignorGtin: '',
        loadingPoint: '', 
        billToParty: '', 
        billToGtin: '',
        isSameAsBillTo: false, 
        shipToParty: '', 
        shipToGtin: '',
        unloadingPoint: '', 
        quantity: 0, 
        materialTypeId: 'MT', 
        lrNumber: '',
        lrDate: null,
        carrierId: '',
        paymentTerm: 'Paid',
        items: [],
        deliveryAddress: '',
    },
  });

  const { watch, setValue, control, handleSubmit, register } = form;
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  
  const isSameAsBillTo = watch('isSameAsBillTo');
  const billToParty = watch('billToParty');
  const billToGtin = watch('billToGtin');
  const originPlantId = watch('originPlantId');
  const materialTypeId = watch('materialTypeId');
  const quantity = watch('quantity');
  const lrNumberValue = watch('lrNumber');

  const showLrSection = useMemo(() => lrNumberValue && lrNumberValue.trim() !== '', [lrNumberValue]);

  useEffect(() => {
    if (materialTypeId === 'FTL') {
        setValue('quantity', 0);
    }
  }, [materialTypeId, setValue]);

  const fetchAuthorizedPlants = useCallback(async () => {
    if (!firestore || !user || isLoadingPlants || !allPlants) return;
    setIsAuthLoading(true);
    try {
        const lastIdentity = localStorage.getItem('slmc_last_identity');
        const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
        
        let userDocSnap = null;
        const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
            userDocSnap = qSnap.docs[0];
        } else {
            const uidSnap = await getDoc(doc(firestore, "users", user.uid));
            if (uidSnap.exists()) userDocSnap = uidSnap;
        }

        let authIds: string[] = [];
        if (userDocSnap) {
            const userData = userDocSnap.data() as SubUser;
            const isRoot = userData.jobRole === 'System Administrator' || userData.username?.toLowerCase() === 'sikkaind' || isAdminSession;
            authIds = isRoot ? allPlants.map(p => p.id) : (userData.plantIds || []);
        } else if (isAdminSession) {
            authIds = allPlants.map(p => p.id);
        }

        const filtered = allPlants.filter(p => authIds.includes(p.id));
        setAuthorizedPlants(filtered);
        if (filtered.length > 0 && !originPlantId) setValue('originPlantId', filtered[0].id);
    } catch (e) {
        console.error("Authorized Plants Sync Error:", e);
    } finally {
        setIsAuthLoading(false);
    }
  }, [firestore, user, allPlants, isLoadingPlants, isAdminSession, setValue, originPlantId]);

  useEffect(() => { fetchAuthorizedPlants(); }, [fetchAuthorizedPlants]);

  const partiesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_parties"), where("isDeleted", "==", false)) : null, 
    [firestore]
  );
  const { data: parties } = useCollection<Party>(partiesQuery);

  const availableConsignors = useMemo(() => {
    if (!parties || !originPlantId) return [];
    const targetPlantId = normalizePlantId(originPlantId).toLowerCase();
    return (parties || []).filter(p => 
        p.type === 'Consignor' && 
        !p.isDeleted &&
        normalizePlantId(p.plantId).toLowerCase() === targetPlantId
    );
  }, [parties, originPlantId]);

  useEffect(() => {
    if (availableConsignors.length === 1) {
        const c = availableConsignors[0];
        setValue('consignor', c.name, { shouldValidate: true });
        setValue('consignorGtin', c.gstin || '', { shouldValidate: true });
        if (c.address && c.address !== 'N/A') {
            setValue('loadingPoint', c.address, { shouldValidate: true });
        }
    } else if (availableConsignors.length === 0 && originPlantId) {
        const plant = authorizedPlants.find(p => p.id === originPlantId);
        if (plant?.address && plant.address !== 'N/A') {
            setValue('loadingPoint', plant.address, { shouldValidate: true });
        }
    }
  }, [availableConsignors, setValue, originPlantId, authorizedPlants]);

  useEffect(() => { 
    if (isSameAsBillTo) {
        setValue('shipToParty', billToParty); 
        setValue('shipToGtin', billToGtin);
    }
  }, [isSameAsBillTo, billToParty, billToGtin, setValue]);

  const consignorRegistry = useMemo(() => {
    const list = (parties || []).filter(p => p.type === 'Consignor');
    return Array.from(new Map(list.map(p => [p.name, p])).values());
  }, [parties]);

  const consigneeRegistry = useMemo(() => {
    const list = (parties || []).filter(p => p.type === 'Consignee & Ship to');
    return Array.from(new Map(list.map(p => [p.name, p])).values());
  }, [parties]);

  const handlePost = async (values: FormValues) => {
    if (!firestore || !user) return;

    // 1. REGISTRY DUPLICATE CHECK: LR Number node uniqueness
    if (values.lrNumber?.trim()) {
        const plantId = normalizePlantId(values.originPlantId);
        const lrRefCol = collection(firestore, `plants/${plantId}/lrs`);
        const q = query(lrRefCol, where("lrNumber", "==", values.lrNumber.trim()), where("carrierId", "==", values.carrierId));
        const snap = await getDocs(q);
        if (!snap.empty) {
            toast({ 
                variant: 'destructive', 
                title: "Registry Conflict", 
                description: `Duplicate LR Number - This LR Number ${values.lrNumber} already exists for the selected Carrier.` 
            });
            return;
        }
    }

    showLoader();
    try {
        await runTransaction(firestore, async (transaction) => {
            // A. COUNTER LOGIC
            const counterRef = doc(firestore, "counters", "shipments");
            const counterSnap = await transaction.get(counterRef);
            const currentCount = counterSnap.exists() ? counterSnap.data().count : 0;
            const newCount = currentCount + 1;
            const shipmentId = formatSequenceId("S", newCount);
            
            // FIX: Robust Name Check (Prevent undefined)
            const currentName = isAdminSession 
                ? 'AJAY SOMRA' 
                : (user.displayName || user.email?.split('@')[0] || 'System Operator');
            
            const userId = user.uid || 'unknown_id';
            const ts = serverTimestamp();

            transaction.set(counterRef, { count: newCount }, { merge: true });

            // B. SHIPMENT PREPARATION
            const plantId = normalizePlantId(values.originPlantId);
            const shipmentDocId = `ship-${Date.now()}`;
            const shipRef = doc(firestore, `plants/${plantId}/shipments`, shipmentDocId);

            let assignedQty = 0;
            let currentStatusId = 'Planned'; // Default status according to your lifecycle

            if (values.lrNumber) {
                assignedQty = values.quantity;
                currentStatusId = 'Assigned';
            }

            const docData: any = {
                ...values,
                shipmentId,
                currentStatusId,
                creationDate: ts,
                lastUpdateDate: ts,
                assignedQty,
                balanceQty: values.lrNumber ? 0 : values.quantity,
                userName: currentName,
                userId: userId,
            };

            transaction.set(shipRef, docData);

            // C. TRIP & LR LOGIC (Only if LR exists)
            if (values.lrNumber) {
                const tripDocId = `trip-${Date.now()}`;
                const tripRef = doc(firestore, `plants/${plantId}/trips`, tripDocId);
                const globalTripRef = doc(firestore, 'trips', tripDocId);
                const generatedTripId = generateRandomTripId();

                const tripData = {
                    tripId: generatedTripId,
                    vehicleId: null,
                    vehicleNumber: '', 
                    driverName: '',
                    driverMobile: '',
                    vehicleType: 'Market Vehicle',
                    carrierId: values.carrierId,
                    assignedTripWeight: values.quantity,
                    assignedQtyInTrip: values.quantity,
                    originPlantId: plantId,
                    destination: values.unloadingPoint || 'N/A',
                    shipmentIds: [shipmentDocId],
                    tripStatus: 'Assigned',
                    podStatus: 'Missing',
                    freightStatus: 'Unpaid',
                    vehicleStatus: 'Available',
                    currentStatusId: 'Assigned',
                    startDate: ts,
                    lrGenerated: true,
                    lrNumber: values.lrNumber,
                    lrDate: values.lrDate,
                    userName: currentName,
                    userId: userId,
                    shipToParty: values.shipToParty || values.billToParty,
                    unloadingPoint: values.unloadingPoint,
                    podReceived: false,
                    isFreightPosted: false
                };

                transaction.set(tripRef, tripData);
                transaction.set(globalTripRef, tripData);

                const lrId = `lr-${Date.now()}`;
                const lrRef = doc(firestore, `plants/${plantId}/lrs`, lrId);
                const lrData = {
                    lrNumber: values.lrNumber,
                    date: values.lrDate,
                    tripId: generatedTripId,
                    tripDocId: tripDocId,
                    carrierId: values.carrierId,
                    originPlantId: plantId,
                    consignorName: values.consignor,
                    consignorGtin: values.consignorGtin,
                    buyerName: values.billToParty,
                    buyerGtin: values.billToGtin,
                    shipToParty: values.shipToParty || values.billToParty,
                    shipToGtin: values.shipToGtin || values.billToGtin,
                    deliveryAddress: values.deliveryAddress || values.unloadingPoint,
                    items: values.items,
                    weightSelection: 'Assigned Weight',
                    assignedTripWeight: values.quantity,
                    paymentTerm: values.paymentTerm,
                    from: values.loadingPoint,
                    to: values.unloadingPoint,
                    createdAt: ts,
                    userName: currentName,
                    userId: userId
                };
                transaction.set(lrRef, lrData);
            }

            // D. ACTIVITY LOG (Important for tracking)
            const logRef = doc(collection(firestore, "activity_logs"));
            transaction.set(logRef, {
                userId: userId,
                userName: currentName,
                action: 'Create Order',
                tcode: 'Order Plan',
                pageName: 'LMC Registry',
                timestamp: ts,
                description: `Generated Sale Order ${shipmentId} for ${values.billToParty}. [Qty: ${values.quantity}]`
            });

            // E. NOTIFICATION ENTRY
            const notifRef = doc(collection(firestore, `users/${userId}/notifications`));
            transaction.set(notifRef, {
                userId: userId,
                userName: currentName,
                actionType: 'Created',
                module: 'Order Plan',
                message: `${currentName} – Created Order – ${shipmentId} – ${format(new Date(), 'dd MMM yyyy p')}`,
                plantId: plantId,
                timestamp: ts,
                isRead: false
            });
        });

        toast({ title: 'Plan Committed', description: `Sale Order committed to lifting node registry.` });
        form.reset();
        setShowConfirmModal(false);
        onShipmentCreated({ id: 'new' } as any); // Trigger parent refresh
    } catch (e: any) {
        console.error("Transaction Error:", e);
        toast({ 
            variant: 'destructive', 
            title: "Commit Failed", 
            description: e.message || "An unexpected error occurred during registry sync." 
        });
    } finally {
        hideLoader();
    }
  };

  const handleTemplateDownload = () => {
    const headers = [
        "Plant ID", "Consignor", "Loading Point", "Consignee", "Ship To", 
        "Unloading Point", "Quantity", "UOM", "Invoice Number", 
        "E-Waybill Number", "Item Description", "Total Units", "Delivery Address",
        "LR Number", "LR Date", "Carrier ID", "Payment Term"
    ];
    const sample = [
        "1426", "Consignor Name", "Dispatch Address", "Consignee Name", "Ship To Name",
        "Dest Address", "25", "MT", "INV-001", "EWB-001", "Salt Bags", "500", "Warehouse 14, Plot 22, Mumbai",
        "LR-1001", "2024-05-20", "carrier-123", "Paid"
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Order Plan Template");
    XLSX.writeFile(wb, "SIKKA_OrderPlan_Bulk_Template.xlsx");
  };

  const handleBulkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firestore || !user) return;

    setIsBulkUploading(true);
    showLoader();
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

            if (jsonData.length === 0) throw new Error("Manifest is empty.");

            const batch = writeBatch(firestore);
            const counterRef = doc(firestore, "counters", "shipments");
            const counterSnap = await getDoc(counterRef);
            let currentCount = counterSnap.exists() ? counterSnap.data().count : 0;

            const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || 'System Operator');
            let successCount = 0;
            let errorsArr: string[] = [];

            for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];
                const rowNum = i + 2;
                try {
                    const plantIdRaw = row["Plant ID"]?.toString().trim();
                    const qty = Number(row["Quantity"]);
                    const uom = row["UOM"]?.toString().trim()?.toUpperCase();
                    const lrNumber = row["LR Number"]?.toString().trim();

                    if (!plantIdRaw || !row["Consignor"] || !row["Consignee"] || !row["Unloading Point"]) {
                        throw new Error(`Row ${rowNum}: Missing mandatory fields (Plant, Consignor, Consignee, Unloading Point).`);
                    }
                    if (uom !== 'FTL' && (isNaN(qty) || qty <= 0)) {
                        throw new Error(`Row ${rowNum}: Invalid numeric quantity.`);
                    }

                    if (lrNumber) {
                        if (!row["LR Date"] || !row["Carrier ID"] || !row["Delivery Address"]) {
                            throw new Error(`Row ${rowNum}: LR provided but missing mandatory LR particulars (Date, Carrier, Delivery Address).`);
                        }
                    }

                    const plantId = normalizePlantId(plantIdRaw);
                    currentCount++;
                    const shipmentId = formatSequenceId("S", currentCount);
                    const shipmentDocId = `ship-${Date.now()}-${i}`;
                    const shipRef = doc(firestore, `plants/${plantId}/shipments`, shipmentDocId);

                    const docData: any = {
                        originPlantId: plantId,
                        consignor: row["Consignor"]?.toString().trim(),
                        loadingPoint: row["Loading Point"]?.toString().trim(),
                        billToParty: row["Consignee"]?.toString().trim(),
                        shipToParty: row["Ship To"]?.toString().trim() || row["Consignee"]?.toString().trim(),
                        unloadingPoint: row["Unloading Point"]?.toString().trim(),
                        quantity: qty,
                        materialTypeId: uom,
                        invoiceNumber: row["Invoice Number"]?.toString().trim() || '',
                        ewaybillNumber: row["E-Waybill Number"]?.toString().trim() || '',
                        itemDescription: row["Item Description"]?.toString().trim() || '',
                        totalUnits: Number(row["Total Units"]) || 0,
                        deliveryAddress: row["Delivery Address"]?.toString().trim() || row["Unloading Point"]?.toString().trim(),
                        shipmentId,
                        currentStatusId: lrNumber ? 'Assigned' : 'Planned',
                        creationDate: new Date(),
                        assignedQty: lrNumber ? qty : 0,
                        balanceQty: lrNumber ? 0 : qty,
                        userName: currentName,
                        userId: user.uid,
                    };

                    batch.set(shipRef, docData);

                    if (lrNumber) {
                        const tripDocId = `trip-${Date.now()}-${i}`;
                        const tripRef = doc(firestore, `plants/${plantId}/trips`, tripDocId);
                        const globalTripRef = doc(firestore, 'trips', tripDocId);
                        const generatedTripId = generateRandomTripId();

                        const tripData = {
                            tripId: generatedTripId,
                            vehicleNumber: '', 
                            driverName: '',
                            driverMobile: '',
                            vehicleType: 'Market Vehicle',
                            carrierId: row["Carrier ID"]?.toString().trim(),
                            assignedTripWeight: qty,
                            assignedQtyInTrip: qty,
                            originPlantId: plantId,
                            destination: row["Unloading Point"]?.toString().trim(),
                            shipmentIds: [shipmentDocId],
                            tripStatus: 'Assigned',
                            podStatus: 'Missing',
                            freightStatus: 'Unpaid',
                            vehicleStatus: 'Available',
                            currentStatusId: 'Assigned',
                            startDate: new Date(),
                            lastUpdated: new Date(),
                            lrGenerated: true,
                            lrNumber: lrNumber,
                            lrDate: new Date(row["LR Date"]),
                            userName: currentName,
                            userId: user.uid,
                            shipToParty: row["Ship To"]?.toString().trim() || row["Consignee"]?.toString().trim(),
                            unloadingPoint: row["Unloading Point"]?.toString().trim(),
                            podReceived: false,
                            isFreightPosted: false
                        };

                        batch.set(tripRef, tripData);
                        batch.set(globalTripRef, tripData);

                        const lrDocId = `lr-${Date.now()}-${i}`;
                        const lrRef = doc(firestore, `plants/${plantId}/lrs`, lrDocId);
                        const lrData = {
                            lrNumber: lrNumber,
                            date: new Date(row["LR Date"]),
                            tripId: generatedTripId,
                            tripDocId: tripDocId,
                            carrierId: row["Carrier ID"]?.toString().trim(),
                            originPlantId: plantId,
                            consignorName: row["Consignor"]?.toString().trim(),
                            buyerName: row["Consignee"]?.toString().trim(),
                            shipToParty: row["Ship To"]?.toString().trim() || row["Consignee"]?.toString().trim(),
                            deliveryAddress: row["Delivery Address"]?.toString().trim(),
                            items: [{
                                invoiceNumber: row["Invoice Number"]?.toString().trim() || 'N/A',
                                ewaybillNumber: row["E-Waybill Number"]?.toString().trim() || '',
                                itemDescription: row["Item Description"]?.toString().trim() || 'Cargo',
                                units: Number(row["Total Units"]) || 1,
                                weight: qty
                            }],
                            weightSelection: 'Assigned Weight',
                            assignedTripWeight: qty,
                            paymentTerm: row["Payment Term"] || 'Paid',
                            from: row["Loading Point"]?.toString().trim(),
                            to: row["Unloading Point"]?.toString().trim(),
                            createdAt: new Date(),
                            userName: currentName,
                            userId: user.uid
                        };
                        batch.set(lrRef, lrData);
                    }

                    successCount++;
                } catch (err: any) {
                    errorsArr.push(err.message);
                }
            }

            if (successCount > 0) {
                batch.set(counterRef, { count: currentCount }, { merge: true });
                await batch.commit();
                toast({ title: "Bulk Upload Complete", description: `${successCount} records successfully committed to mission registry.` });
                onShipmentCreated({ id: 'new' } as any);
            }

            if (errorsArr.length > 0) {
                toast({ 
                    variant: 'destructive', 
                    title: "Registry Discrepancies", 
                    description: `Total Success: ${successCount} | Total Failed: ${errorsArr.length}. Review error manifest for details.` 
                });
                console.error("Bulk Upload Error Manifest:", errorsArr);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Bulk Error", description: error.message });
        } finally {
            setIsBulkUploading(false);
            hideLoader();
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRegistrySelect = (party: Party) => {
    if (!helpModal) return;
    setValue(helpModal.type as any, party.name, { shouldValidate: true });
    
    if (helpModal.type === 'consignor') {
        setValue('consignorGtin', party.gstin || '', { shouldValidate: true });
    } else if (helpModal.type === 'billToParty') {
        setValue('billToGtin', party.gstin || '', { shouldValidate: true });
        if (isSameAsBillTo) {
            setValue('shipToGtin', party.gstin || '', { shouldValidate: true });
        }
    } else if (helpModal.type === 'shipToParty') {
        setValue('shipToGtin', party.gstin || '', { shouldValidate: true });
    }

    setHelpModal(null);
  };

  const openSearchHelp = (type: 'consignor' | 'billToParty' | 'shipToParty') => {
    const registryData = type === 'consignor' ? consignorRegistry : consigneeRegistry;
    const registryTitle = type === 'consignor' ? 'Select Consignor Node' : 'Select Consignee Node';
    setHelpModal({ type, title: registryTitle, data: registryData });
  };

  const isReadOnlyPlant = !isAdminSession && authorizedPlants.length === 1;

  return (
    <div className="w-full space-y-10">
        <div className="flex justify-end gap-4 px-2">
            <Button variant="outline" className="h-10 rounded-xl font-black uppercase text-[10px] tracking-widest border-slate-200" onClick={handleTemplateDownload}>
                <FileDown className="h-4 w-4 mr-2" /> Download Bulk Template
            </Button>
            <Button variant="outline" asChild className="h-10 rounded-xl font-black uppercase text-[10px] tracking-widest border-slate-200 cursor-pointer">
                <label>
                    <Upload className="h-4 w-4 mr-2" /> Bulk Registry Upload
                    <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleBulkUpload} disabled={isBulkUploading} />
                </label>
            </Button>
        </div>

        <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-[2.5rem]">
            <CardHeader className="bg-slate-50 border-b pb-8 px-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                            <ShieldCheck className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-4xl font-black text-blue-900 tracking-tight leading-none italic uppercase">Create Order</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">Lifting Node Registry Partition</CardDescription>
                        </div>
                    </div>

                    <div className="flex items-center gap-10 bg-white/50 backdrop-blur-md px-10 py-4 rounded-[2rem] border-2 border-slate-100 shadow-xl shadow-blue-900/5">
                        <div className="flex flex-col gap-1 text-center">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Aggregate Quantity</span>
                            <span className="text-xl font-black text-blue-900 leading-none">
                                {materialTypeId === 'FTL' ? 'FTL' : `${quantity || '0.00'} ${materialTypeId}`}
                            </span>
                        </div>
                        <Separator orientation="vertical" className="h-10 bg-slate-200" />
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Status Node</span>
                            <Badge className="bg-orange-50 text-orange-700 font-black uppercase text-[10px] border-none shadow-sm h-6 px-4 justify-center">PENDING</Badge>
                        </div>
                    </div>
                </div>
            </CardHeader>
            
            <CardContent className="pt-12 px-10 pb-12 space-y-16">
                <Form {...form}>
                <form className="space-y-16">
                    {/* TOP SECTION: SYSTEM META */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start bg-slate-50/50 p-10 rounded-[3rem] border border-slate-100 shadow-inner">
                        <div className="md:col-span-3 space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Registry Timestamp</label>
                            <div className="h-14 px-6 flex items-center bg-white rounded-2xl border border-slate-200 text-blue-900 font-black text-lg italic font-mono shadow-sm">
                                {format(currentDate, 'dd-MM-yyyy HH:mm:ss')}
                            </div>
                        </div>

                        <div className="md:col-span-3">
                            <FormField control={control} name="originPlantId" render={({ field }) => (
                                <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Plant Node Registry *</FormLabel>
                                {isReadOnlyPlant ? (
                                    <div className="h-14 px-6 flex items-center bg-white border border-slate-200 rounded-2xl font-black text-blue-900 uppercase text-sm shadow-sm">
                                        <ShieldCheck className="h-4 w-4 mr-2 text-blue-600" /> {authorizedPlants[0]?.name || 'Authorized Node'}
                                    </div>
                                ) : (
                                    <Select onValueChange={field.onChange} value={field.value} disabled={isAuthLoading}>
                                        <FormControl><SelectTrigger className="bg-white h-14 rounded-2xl font-black text-blue-900 shadow-sm border-slate-200"><SelectValue placeholder={isAuthLoading ? "Syncing..." : "Select Plant"} /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">{authorizedPlants.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3 uppercase italic">{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                )}
                                </FormItem>
                            )} />
                        </div>

                        <div className="md:col-span-3">
                            <FormField control={control} name="materialTypeId" render={({ field }) => (
                                <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">UOM (Unit of Measurement) *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-14 bg-white rounded-2xl font-black text-slate-700 shadow-sm border-slate-200">
                                            <SelectValue placeholder="Select UOM" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-xl">
                                        {qtyTypes && qtyTypes.length > 0 ? (
                                            qtyTypes.map(t => <SelectItem key={t.id} value={t.name} className="font-bold py-3 uppercase italic">{t.name}</SelectItem>)
                                        ) : (
                                            <>
                                                <SelectItem value="MT" className="font-bold py-3 uppercase italic">Metric Ton (MT)</SelectItem>
                                                <SelectItem value="BAG" className="font-bold py-3 uppercase italic">Bag</SelectItem>
                                                <SelectItem value="BOX" className="font-bold py-3 uppercase italic">Box</SelectItem>
                                                <SelectItem value="DRUM" className="font-bold py-3 uppercase italic">Drum</SelectItem>
                                                <SelectItem value="PCS" className="font-bold py-3 uppercase italic">PCS</SelectItem>
                                                <SelectItem value="PALLET" className="font-bold py-3 uppercase italic">Pallet</SelectItem>
                                                <SelectItem value="FTL" className="font-bold py-3 uppercase italic">Full Truck Load (FTL)</SelectItem>
                                                <SelectItem value="Others" className="font-bold py-3 uppercase italic">Others</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                                </FormItem>
                            )} />
                        </div>

                        <div className="md:col-span-3">
                            <FormField control={control} name="quantity" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={cn("text-[10px] font-black uppercase tracking-[0.2em] px-1", materialTypeId === 'FTL' ? "text-slate-200" : "text-slate-400")}>
                                        Total Quantity {materialTypeId !== 'FTL' && ''}
                                    </FormLabel>
                                    <FormControl>
                                        <Input 
                                            type="number" 
                                            {...field} 
                                            value={materialTypeId === 'FTL' ? '' : (field.value ?? '')} 
                                            disabled={materialTypeId === 'FTL'}
                                            className={cn(
                                                "h-14 rounded-2xl font-black text-blue-900 text-2xl shadow-inner focus-visible:ring-blue-900",
                                                materialTypeId === 'FTL' ? "bg-slate-100 border-slate-100" : "bg-white border-blue-900/20"
                                            )} 
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </div>

                    {/* OPTIONAL LR SECTION (TOP HEADER) */}
                    <div className="p-10 rounded-[3rem] border-2 border-blue-100 bg-white shadow-xl space-y-10">
                        <div className="flex items-center gap-3 border-b pb-4">
                            <FileText className="h-6 w-6 text-blue-600" />
                            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-700">Optional LR Registry Section</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                            <FormField control={control} name="lrNumber" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">LR Number</FormLabel>
                                    <FormControl><Input placeholder="Enter LR Number" {...field} className="h-12 rounded-xl font-black text-blue-900 uppercase" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            {showLrSection && (
                                <>
                                    <FormField control={control} name="lrDate" render={({ field }) => (
                                        <FormItem className="flex flex-col animate-in fade-in slide-in-from-top-2 duration-300">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">LR Date *</FormLabel>
                                            <FormControl><DatePicker date={field.value || undefined} setDate={(d) => field.onChange(d || null)} className="h-12 border-blue-200" placeholder="Select LR Date" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="carrierId" render={({ field }) => (
                                        <FormItem className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Carrier Registry *</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-12 border-blue-200 font-bold"><SelectValue placeholder="Select Carrier" /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-xl">
                                                    {carriers?.filter(c => c && c.id && c.name).map(c => <SelectItem key={c.id} value={c.id} className="font-bold py-3">{c.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="paymentTerm" render={({ field }) => (
                                        <FormItem className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Payment Term *</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-12 border-blue-200 font-bold"><SelectValue placeholder="Pick Term" /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-xl">
                                                    {PaymentTerms.map(term => <SelectItem key={term} value={term} className="font-bold py-3">{term}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </>
                            )}
                        </div>
                    </div>

                    {/* CENTRE SECTION: CONSIGNOR & CONSIGNEE */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* CONSIGNOR BLOCK */}
                        <div className="space-y-10 p-10 rounded-[3.5rem] border border-slate-100 bg-white shadow-2xl relative overflow-hidden group/con">
                            <div className="absolute top-0 left-0 w-2 h-full bg-blue-900 transition-all duration-500 group-hover/con:w-3" />
                            
                            <FormField control={control} name="consignor" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 flex items-center gap-2">
                                        <Factory className="h-3.5 w-3.5" /> Consignor Entity *
                                    </FormLabel>
                                    <div className="flex gap-3">
                                        {availableConsignors.length > 1 ? (
                                            <Select onValueChange={(val) => {
                                                field.onChange(val);
                                                const match = availableConsignors.find(c => c.name === val);
                                                if (match) {
                                                    setValue('consignorGtin', match.gstin || '', { shouldValidate: true });
                                                    if (match.address && match.address !== 'N/A') {
                                                        setValue('loadingPoint', match.address, { shouldValidate: true });
                                                    }
                                                }
                                            }} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-14 rounded-2xl font-black text-slate-900 border-slate-200 bg-white shadow-sm focus:ring-blue-900">
                                                        <SelectValue placeholder="Select Consignor Node" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl">
                                                    {availableConsignors.map(c => (
                                                        <SelectItem key={c.id} value={c.name} className="font-bold py-3 uppercase italic">
                                                            {c.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <FormControl>
                                                <Input 
                                                    placeholder="Type legal name or resolve from handbook..." 
                                                    {...field} 
                                                    className="h-14 rounded-2xl font-black text-slate-900 border-slate-200 bg-slate-50/30 focus-visible:ring-blue-900"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'F4') { e.preventDefault(); openSearchHelp('billToParty'); }
                                                    }}
                                                />
                                            </FormControl>
                                        )}
                                        <Button type="button" variant="outline" size="icon" className="h-14 w-14 rounded-2xl shrink-0 shadow-lg hover:bg-blue-50 transition-all active:scale-95" onClick={() => openSearchHelp('consignor')}>
                                            <Search className="h-6 w-6 text-blue-600" />
                                        </Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={control} name="loadingPoint" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 px-1 flex items-center gap-2">
                                        <MapPin className="h-3.5 w-3.5" /> Lifting Address (FROM) *
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative group/map">
                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within/map:text-blue-600 transition-colors" />
                                            <Input {...field} placeholder="Enter verified physical loading node address..." className="pl-12 h-14 rounded-2xl font-bold border-slate-200 bg-white focus-visible:ring-blue-900 shadow-sm" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        {/* CONSIGNEE BLOCK */}
                        <div className="space-y-10 p-10 rounded-[3.5rem] border border-slate-100 bg-white shadow-2xl relative overflow-hidden group/cnee">
                            <div className="absolute top-0 left-0 w-2 h-full bg-emerald-600 transition-all duration-500 group-hover/cnee:w-3" />
                            
                            <div className="space-y-8">
                                <div className="space-y-2">
                                    <FormField control={control} name="billToParty" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 flex items-center gap-2">
                                                <User className="h-3.5 w-3.5" /> Consignee / Bill to *
                                            </FormLabel>
                                            <div className="flex gap-3">
                                                <FormControl>
                                                    <Input 
                                                        placeholder="Type name or search buyer registry..." 
                                                        {...field} 
                                                        className="h-14 rounded-2xl font-black text-slate-900 border-slate-200 bg-slate-50/30 focus-visible:ring-emerald-600"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'F4') { e.preventDefault(); openSearchHelp('billToParty'); }
                                                        }}
                                                    />
                                                </FormControl>
                                                <Button type="button" variant="outline" size="icon" className="h-14 w-14 rounded-2xl shrink-0 shadow-lg hover:bg-emerald-50 transition-all active:scale-95" onClick={() => openSearchHelp('billToParty')}>
                                                    <Search className="h-6 w-6 text-emerald-600" />
                                                </Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <div className="flex justify-end">
                                        <FormField control={control} name="isSameAsBillTo" render={({ field }) => (
                                            <FormItem className="flex items-center space-x-3">
                                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900" /></FormControl>
                                                <FormLabel className="text-[10px] font-black uppercase cursor-pointer text-slate-400 tracking-widest !mt-0">Same</FormLabel>
                                            </FormItem>
                                        )} />
                                    </div>
                                </div>

                                <FormField control={control} name="shipToParty" render={({ field }) => (
                                    <FormItem className="w-full">
                                        <FormLabel className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Ship to Node *</FormLabel>
                                        <div className="flex gap-3">
                                            <FormControl>
                                                <Input 
                                                    placeholder="Target node..." 
                                                    {...field} 
                                                    className="h-12 rounded-xl font-bold border-slate-200"
                                                    disabled={isSameAsBillTo}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'F4') { e.preventDefault(); openSearchHelp('shipToParty'); }
                                                    }}
                                                />
                                            </FormControl>
                                            <Button type="button" variant="outline" size="icon" className="h-12 w-12 rounded-xl shrink-0" disabled={isSameAsBillTo} onClick={() => openSearchHelp('shipToParty')}>
                                                <Search className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={control} name="unloadingPoint" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[11px] font-black uppercase tracking-widest text-blue-600 px-1 flex items-center gap-2">
                                            <MapPin className="h-3.5 w-3.5" /> Destination (TO) *
                                        </FormLabel>
                                        <FormControl>
                                            <div className="relative group/map">
                                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within/map:text-blue-600 transition-colors" />
                                                <Input {...field} placeholder="Final mission delivery address node..." className="pl-12 h-14 rounded-2xl font-bold border-slate-200 bg-white focus-visible:ring-blue-900 shadow-sm" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    </div>

                    {/* CONSIGNMENT MANIFEST (MULTI-ROW) SECTION */}
                    <section className={cn("space-y-6 transition-all duration-500", !showLrSection && "opacity-30 grayscale pointer-events-none")}>
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                                <ListTree className="h-4 w-4 text-blue-600" /> 3. Item Description Manifest
                            </h3>
                            {showLrSection && (
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    className="gap-2 font-black text-[10px] uppercase border-blue-200 text-blue-700 bg-white hover:bg-blue-50" 
                                    onClick={() => append({ invoiceNumber: '', ewaybillNumber: '', itemDescription: '', units: 1, weight: 0 })}
                                >
                                    <PlusCircle className="h-3.5 w-3.5" /> Add Row
                                </Button>
                            )}
                        </div>
                        
                        <div className="rounded-[2.5rem] border-2 border-slate-200 bg-white shadow-xl overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-900">
                                    <TableRow className="hover:bg-transparent border-none h-12">
                                        <TableHead className="text-[10px] font-black uppercase text-white px-6 w-40">Invoice Number *</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-white px-4 w-40">E-Waybill No</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-white px-4">Item Description *</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-white px-4 text-center w-24">Units *</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-white px-6 text-right w-32">Weight (Opt)</TableHead>
                                        <TableHead className="w-16"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="h-32 text-center text-slate-400 italic">No entries node. Click "Add Row" to initialize manifest.</TableCell></TableRow>
                                    ) : (
                                        fields.map((field, idx) => (
                                            <TableRow key={field.id} className="h-16 border-b border-slate-100 last:border-0 hover:bg-blue-50/10 group transition-colors">
                                                <TableCell className="px-6 py-2">
                                                    <FormField name={`items.${idx}.invoiceNumber`} control={control} render={({ field: itm }) => (
                                                        <FormControl><Input placeholder="Invoice #" className="h-10 border-slate-200 font-bold" {...itm} /></FormControl>
                                                    )} />
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <FormField name={`items.${idx}.ewaybillNumber`} control={control} render={({ field: itm }) => (
                                                        <FormControl><Input placeholder="EWB-" className="h-10 bg-transparent border-none shadow-none focus-visible:ring-0" {...itm} /></FormControl>
                                                    )} />
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <FormField name={`items.${idx}.itemDescription`} control={control} render={({ field: itm }) => (
                                                        <FormControl><Input placeholder="Cargo particulars" className="h-10 font-medium" {...itm} /></FormControl>
                                                    )} />
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <FormField name={`items.${idx}.units`} control={control} render={({ field: itm }) => (
                                                        <FormControl><Input type="number" className="h-10 text-center font-black text-blue-900" {...itm} /></FormControl>
                                                    )} />
                                                </TableCell>
                                                <TableCell className="px-6 py-2">
                                                    <FormField name={`items.${idx}.weight`} control={control} render={({ field: itm }) => (
                                                        <FormControl><Input type="number" step="0.001" className="h-10 text-right font-bold" {...itm} /></FormControl>
                                                    )} />
                                                </TableCell>
                                                <TableCell className="pr-6 text-right">
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-200 hover:text-red-600" onClick={() => remove(idx)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </section>

                    {/* NEW SECTION: DELIVERY ADDRESS REGISTRY */}
                    {showLrSection && (
                        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2 px-1">
                                <MapPin className="h-4 w-4 text-blue-600"/> 4. Delivery Address Registry
                            </h3>
                            <FormField control={control} name="deliveryAddress" render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Textarea 
                                            rows={3} 
                                            placeholder="Provide verified delivery address particulars for LR document..." 
                                            className="resize-none bg-white border-slate-200 rounded-3xl p-8 font-bold shadow-sm focus-visible:ring-blue-900 transition-all" 
                                            {...field} 
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </section>
                    )}

                    {/* BOTTOM ACTION BAR */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-12 border-t border-slate-100">
                        <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100 flex items-start gap-5 shadow-sm max-w-2xl">
                            <AlertCircle className="h-8 w-8 text-blue-600 shrink-0" />
                            <div className="space-y-1">
                                <p className="text-xs font-black text-blue-900 uppercase">Commitment Protocol Active</p>
                                <p className="text-[10px] font-bold text-blue-700 leading-normal uppercase">
                                    Submitting this form will create a persistent Sale Order node in the lifting registry. Verify all party nodes and address identifiers before final commit.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-6">
                            <Button type="button" variant="ghost" onClick={() => form.reset()} className="px-12 h-16 font-black uppercase text-[11px] tracking-[0.2em] text-slate-400 hover:text-red-600 transition-all rounded-[1.5rem]">Discard Draft</Button>
                            <Button type="button" onClick={handleSubmit(() => setShowConfirmModal(true))} className="bg-blue-900 hover:bg-black text-white px-20 h-16 rounded-[1.5rem] font-black uppercase text-[11px] tracking-[0.3em] shadow-2xl shadow-blue-900/30 transition-all active:scale-95 border-none">
                                COMMIT MISSION PLAN (F8)
                            </Button>
                        </div>
                    </div>
                </form>
                </Form>
            </CardContent>
        </Card>

        <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
            <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-3xl bg-white rounded-[2rem]">
                <DialogHeader className="p-8 bg-blue-900 text-white flex flex-row items-center gap-5 space-y-0">
                    <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
                        <ShieldCheck className="h-8 w-8 text-blue-400" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Registry Commitment</DialogTitle>
                        <DialogDescription className="text-blue-200 font-bold uppercase text-[9px] mt-2 tracking-widest">Authorized Identity Handshake Required</DialogDescription>
                    </div>
                </DialogHeader>
                <div className="p-10 space-y-8">
                    <div className="space-y-4">
                        <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                            "You are about to establish a permanent mission node in the Logistics Registry for 
                            **{materialTypeId === 'FTL' ? 'FTL' : `${quantity} ${materialTypeId}`}** cargo."
                        </p>
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                            <div className="flex flex-col"><span className="text-[8px] font-black uppercase text-slate-400">Node</span> <span className="text-xs font-black text-blue-900 uppercase">{form.watch('originPlantId')}</span></div>
                            <div className="flex flex-col"><span className="text-[8px] font-black uppercase text-slate-400">Operator</span> <span className="text-xs font-black text-slate-900 uppercase">{user?.displayName || user?.email?.split('@')[0]}</span></div>
                        </div>
                    </div>
                    <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3 shadow-inner">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-amber-800 leading-normal uppercase">
                            Authorized Data Capture: Verify weights and party nodes.
                        </p>
                    </div>
                </div>
                <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
                    <Button variant="ghost" onClick={() => setShowConfirmModal(false)} className="font-bold text-slate-500 uppercase text-[10px] tracking-widest px-8 h-11">Back</Button>
                    <Button onClick={handleSubmit(handlePost)} className="bg-blue-900 hover:bg-black text-white px-10 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-100 border-none transition-all active:scale-95">Confirm Commit</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {helpModal && (
            <SearchRegistryModal 
                isOpen={!!helpModal}
                onClose={() => setHelpModal(null)}
                title={helpModal.title}
                data={helpModal.data}
                onSelect={handleRegistrySelect}
            />
        )}
    </div>
  );
}

function SearchRegistryModal({ 
    isOpen, 
    onClose, 
    title, 
    data, 
    onSelect 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    title: string; 
    data: any[]; 
    onSelect: (party: Party) => void;
}) {
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        const s = search.toLowerCase();
        return data.filter(item => item.name.toLowerCase().includes(s));
    }, [data, search]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
                <DialogHeader className="p-6 bg-slate-900 text-white">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3">
                        <Search className="h-5 w-5 text-blue-400" /> {title}
                    </DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                        Select a verified node from the mission registry
                    </DialogDescription>
                </DialogHeader>
                <div className="p-8 space-y-6">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                        <Input 
                            placeholder="Type to filter registry handbook..." 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-12 h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold focus-visible:ring-blue-900 shadow-inner"
                            autoFocus
                        />
                    </div>
                    <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-xl bg-white">
                        <ScrollArea className="h-[40vh]">
                            <Table>
                                <TableHeader className="sticky top-0 bg-slate-100 z-10 border-b">
                                    <TableRow className="hover:bg-transparent h-12">
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest px-6">Registry Node Name</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest px-4 text-center">GSTIN</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest px-6 text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="h-48 text-center text-slate-400 italic uppercase tracking-[0.2em] opacity-40">No nodes matching search.</TableCell></TableRow>
                                    ) : (
                                        filtered.map(item => (
                                            <TableRow key={item.id} className="cursor-pointer h-14 transition-all group hover:bg-blue-50 border-b last:border-0" onClick={() => onSelect(item)}>
                                                <TableCell className="px-6 font-black text-slate-800 uppercase text-xs tracking-tight">{item.name}</TableCell>
                                                <TableCell className="px-4 text-center font-mono text-[10px] font-bold text-slate-500">{item.gstin || '--'}</TableCell>
                                                <TableCell className="px-6 text-right">
                                                    <Button variant="ghost" size="sm" className="h-8 rounded-lg text-blue-600 font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">Select Node</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Close Window</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
