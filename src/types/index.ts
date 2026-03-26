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
<<<<<<< HEAD
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
=======
>>>>>>> b03da71b02804bd380f8967e7bc8966de6ba53b8
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
