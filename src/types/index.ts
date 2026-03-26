export interface WithId<T> {
  id: string;
  [key: string]: any;
}

export interface Shipment {
  shipmentId: string;
  consignor: string;
  consignorGtin?: string;
  billToParty: string;
  billToGtin?: string;
  shipToParty?: string;
  shipToGtin?: string;
  unloadingPoint: string;
  loadingPoint: string;
  originPlantId: string;
  quantity: number;
  balanceQty: number;
  assignedQty: number;
  material: string;
  carrierId: string;
  currentStatusId: string;
  lastUpdateDate: any;
  lrNumber?: string;
  lrDate?: any;
  paymentTerm?: string;
  items?: any[];
}

export interface Vehicle {
  vehicleNumber: string;
  driverName: string;
  driverMobile: string;
  vehicleType: 'Own Vehicle' | 'Contract Vehicle' | 'Market Vehicle';
  plantId: string;
  status: string;
  createdAt: any;
}

export interface Trip {
  tripId: string;
  vehicleId: string | null;
  vehicleNumber: string;
  driverName: string;
  driverMobile: string;
  vehicleType: 'Own Vehicle' | 'Contract Vehicle' | 'Market Vehicle';
  carrierId: string;
  assignedTripWeight: number;
  assignedQtyInTrip: number;
  originPlantId: string;
  destination: string;
  shipmentIds: string[];
  tripStatus: string;
  podStatus: string;
  freightStatus: string;
  vehicleStatus: string;
  currentStatusId: string;
  startDate: any;
  lastUpdated: any;
  userName: string;
  userId: string;
  shipToParty: string;
  unloadingPoint: string;
  lrGenerated: boolean;
  lrNumber: string;
  lrDate: any;
  paymentTerm?: string;
  transporterName?: string;
  transporterMobile?: string;
  ownerName?: string;
  ownerMobile?: string;
  ownerPan?: string;
  podReceived: boolean;
  isFreightPosted: boolean;
  distance: number;
}

export interface Carrier {
  id: string;
  name: string;
  plantId?: string;
  address?: string;
  gstin?: string;
  pan?: string;
  stateName?: string;
  stateCode?: string;
  email?: string;
  mobile?: string;
  website?: string;
  logoUrl?: string;
  terms?: string[];
}

export interface VehicleEntry {
  plantId: string;
  vehicleNumber: string;
  driverName: string;
  driverMobile?: string;
  vehicleId?: string;
  purpose: string;
  remarks?: string;
  status: 'IN' | 'OUT';
}

export interface Plant {
  id: string;
  name: string;
  address?: string;
}

export interface SubUser {
  fullName: string;
  username: string;
  jobRole: string;
  plantIds: string[];
}

export interface Party {
  id: string;
  name: string;
  type?: 'Consignor' | 'Consignee & Ship to';
  isDeleted?: boolean;
  plantId?: string;
  gstin?: string;
  address?: string;
  city?: string;
}

export interface MasterQtyType {
  id: string;
  name: string;
}

export const pagePermissions = {
  'dashboard': 'Dashboard',
  'user-management': 'User Management',
  'sub-user-management': 'Sub-User Management',
  'shipment-plan': 'Shipment Plan',
  'vehicle-assign': 'Vehicle Assign',
  'trip-board': 'Trip Board',
  'shipment-tracking': 'Shipment Tracking',
  'status-management': 'Status Management',
  'vehicle-entry': 'Vehicle Entry',
  'freight-process': 'Freight Process',
  'freight-management': 'Freight Management',
  'fuel-management': 'Fuel Management',
  'fuel-payment': 'Fuel Payment',
  'fuel-pump': 'Fuel Pump Management',
  'carrier-management': 'Carrier Management',
  'plant-management': 'Plant Management',
  'employee-management': 'Employee Management',
  'attendance-register': 'Attendance Register',
  'report-analysis': 'Report & Analysis',
  'trip-summary': 'Trip Summary',
  'shipment-summary': 'Shipment Summary',
  'user-activity-log': 'User Activity Log',
  'rejection-shortage': 'Rejection/Shortage',
  'recycle-bin': 'Recycle Bin',
  'lr-create': 'LR Create',
  'tracking': 'Tracking',
};

export type PageKey = keyof typeof pagePermissions;

export type VehicleLocation = string;

export interface User {
  id: string;
  fullName: string;
  mobile: string;
  username: string;
  jobRole: string;
  plantIds: string[];
  permissions: PageKey[];
  status: 'Active' | 'Inactive';
  email: string;
  password?: string;
  authorizedLocations?: VehicleLocation[];
}
