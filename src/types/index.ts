
import { Timestamp } from 'firebase/firestore';

export type WithId<T> = T & { id: string };

export type VehicleStatus = 'Available' | 'Assigned' | 'In Transit' | 'Arrival for Delivery' | 'Delivered' | 'Break-down' | 'Under Maintenance' | 'Inactive';
export type TripStatus = 'Assigned' | 'Vehicle Assigned' | 'Loaded' | 'Loading Complete' | 'In Transit' | 'Arrived' | 'Arrival for Delivery' | 'Delivered' | 'Closed' | 'Cancelled';
export type PODStatus = 'None' | 'Missing' | 'Receipt Soft Copy' | 'Hard Copy' | 'Verified';

export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  mobile: string;
  jobRole: string;
  status: 'Active' | 'Inactive';
  plantIds: string[];
  permissions: string[];
  password?: string;
  photoURL?: string;
}

export interface SubUser extends User {
  access_logistics?: boolean;
  access_accounts?: boolean;
  defaultModule?: string;
  accounts_plant_ids?: string[];
}

export interface Plant {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isMainPlant?: boolean;
}

export interface Vehicle {
  id: string;
  vehicleNumber: string;
  registrationNumber?: string;
  vehicleType: string;
  status: VehicleStatus;
  driverId: string;
  driverName: string;
  driverMobile: string;
  lastOdometerReading?: number;
  plantId: string;
  gps_enabled?: boolean;
  gpsImeiNo?: string;
  gps_provider?: string;
  isDeleted?: boolean;
}

export interface Shipment {
  id: string;
  shipmentId: string;
  originPlantId: string;
  consignor: string;
  consignorGtin?: string;
  loadingPoint: string;
  billToParty: string;
  billToGtin?: string;
  shipToParty?: string;
  shipToGtin?: string;
  unloadingPoint: string;
  destination: string;
  quantity: number;
  assignedQty: number;
  balanceQty: number;
  materialTypeId: string;
  material?: string;
  currentStatusId: string;
  creationDate: any;
  lastUpdateDate?: any;
  invoiceNumber?: string;
  ewaybillNumber?: string;
  totalUnits?: number;
  itemDescription?: string;
  paymentTerm?: string;
  lrNumber?: string;
  lrDate?: any;
  items?: any[];
  deliveryAddress?: string;
  cancelledAt?: any;
  cancelledBy?: string;
  cancelReason?: string;
  shortClosedAt?: any;
  shortClosedBy?: string;
}

export interface Trip {
  id: string;
  tripId: string;
  vehicleId: string | null;
  vehicleNumber: string;
  driverName: string;
  driverMobile: string;
  vehicleType: string;
  carrierId: string;
  assignedTripWeight: number;
  assignedQtyInTrip: number;
  originPlantId: string;
  destination: string;
  shipmentIds: string[];
  tripStatus: TripStatus;
  podStatus: PODStatus;
  freightStatus: string;
  vehicleStatus: string;
  currentStatusId: string;
  startDate: any;
  lastUpdated: any;
  userName?: string;
  userId?: string;
  lrNumber?: string;
  lrDate?: any;
  outDate?: any;
  arrivalDate?: any;
  actualCompletionDate?: any;
  unloadQty?: number;
  podReceived?: boolean;
  podUrl?: string;
  freightAmount?: number;
  freightRate?: number;
  transporterName?: string;
  transporterMobile?: string;
  ownerName?: string;
  ownerPan?: string;
  distance?: number;
  otherCharges?: any[];
  freightReceiverName?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
  bankingAccounts?: any[];
}

export interface LR {
  id: string;
  lrNumber: string;
  date: any;
  tripId: string;
  tripDocId?: string;
  carrierId: string;
  originPlantId: string;
  vehicleNumber: string;
  driverName?: string;
  driverMobile?: string;
  consignorName: string;
  consignorGtin?: string;
  consignorMobile?: string;
  consignorAddress?: string;
  buyerName: string;
  buyerGtin?: string;
  buyerMobile?: string;
  shipToParty: string;
  shipToGtin?: string;
  shipToMobile?: string;
  from: string;
  to: string;
  assignedTripWeight: number;
  items: any[];
  weightSelection: string;
  paymentTerm: string;
  deliveryAddress: string;
  transportMode: string;
}

export interface Freight {
  id: string;
  tripId: string;
  originPlantId: string;
  totalFreightAmount: number;
  baseFreightAmount: number;
  advanceAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  podStatus: string;
  charges?: any[];
  payments?: any[];
  lastUpdated: any;
}

export interface Notification {
  id: string;
  userId: string;
  userName: string;
  actionType: string;
  module: string;
  message: string;
  entityId?: string;
  plantId?: string;
  timestamp: any;
  isRead: boolean;
  details?: Record<string, any>;
}

export interface Activity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  tcode: string;
  pageName: string;
  timestamp: any;
  description: string;
}

export interface Carrier {
  id: string;
  name: string;
  logoUrl?: string;
  address: string;
  gstin: string;
  pan: string;
  stateName: string;
  stateCode: string;
  email: string;
  mobile: string;
  website?: string;
  terms: string[];
  plantId: string;
  isDeleted?: boolean;
}

export interface Party {
  id: string;
  name: string;
  type: string;
  gstin?: string;
  pan?: string;
  mobile?: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  isDeleted?: boolean;
  plantId: string;
}

export interface VehicleEntryExit {
  id: string;
  vehicleId: string;
  vehicleNumber: string;
  driverName: string;
  driverMobile: string;
  licenseNumber?: string;
  plantId: string;
  status: 'IN' | 'OUT';
  entryTimestamp: any;
  exitTimestamp?: any;
  purpose: string;
  outType?: string;
  lrNumber?: string;
  qty?: string;
  remarks?: string;
  isTaskCompleted?: boolean;
  tripId?: string;
  billedQty?: number;
  qtyType?: string;
  documentNo?: string;
  items?: string;
  statusUpdatedAt?: any;
  statusUpdatedBy?: string;
}

export interface FuelPump {
  id: string;
  name: string;
  ownerName: string;
  mobile: string;
  pan?: string;
  gstin?: string;
  address?: string;
  paymentMethod?: string;
  receiverName?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
  qrCodeUrl?: string;
}

export interface FuelEntry {
  id: string;
  slipNo: string;
  date: any;
  plantId: string;
  fuelType: string;
  pumpId: string;
  pumpName?: string;
  vehicleType: string;
  vehicleId?: string;
  vehicleNumber: string;
  driverName?: string;
  ownerName?: string;
  fuelLiters: number;
  fuelRate: number;
  fuelAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  payments: any[];
  userName: string;
  currentReading?: number;
  previousReading?: number;
  distance?: number;
  average?: number;
  tripDate?: any;
  tripDestination?: string;
  weight?: number;
  freight?: number;
  lrNumber?: string;
  lrDate?: any;
  fuelSlipImageUrl?: string;
}

export interface FuelPayment {
  id: string;
  pumpId: string;
  pumpName?: string;
  fromDate: any;
  toDate: any;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMethod: string;
  paymentDate: any;
  bankingRef?: string;
  paidBy: string;
}

export interface RecycledItem {
  id: string;
  pageName: string;
  userName: string;
  deletedAt: any;
  data: any;
}

export interface MasterQtyType {
  id: string;
  name: string;
}

export interface ShipmentStatusMaster {
  id: string;
  name: string;
  description: string;
}

export interface OwnVehicle {
  id: string;
  vehicleNumber: string;
  driverName: string;
  driverMobile: string;
  licenseNumber: string;
  pollutionCertValidity?: any;
  fitnessCertValidity?: any;
  permitCertValidity?: any;
}

export interface ContractVehicle extends OwnVehicle {
  ownerName: string;
  ownerMobile: string;
  pan: string;
  contractFrom: any;
  validUpto: any;
}

export interface MarketVehicle extends OwnVehicle {
  transporterName: string;
  transporterMobile: string;
  pan: string;
}

export interface Customer {
  id: string;
  clientType: string;
  code?: string;
  name: string;
  address: string;
  gstin?: string;
  pan?: string;
  state: string;
  stateCode: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  bankDetails?: string;
}

export interface MasterDataItem {
  id: string;
  plantId: string;
  invoiceType: string;
  chargeType: string;
  itemDescription: string;
  hsnSac: string;
  unitType: string;
  rate: number;
  isGstApplicable: boolean;
  gstRate: number;
  validFrom: any;
  validTo: any;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceType: string;
  isAutoInvoiceNo: boolean;
  invoiceDate: any;
  billMonth: string;
  consignorId: string;
  consigneeId: string;
  plantId: string;
  chargeType: string;
  items: any[];
  totals: any;
  isPosted: boolean;
  irn?: string;
  irnGeneratedAt?: any;
}

export type PageKey = string;
