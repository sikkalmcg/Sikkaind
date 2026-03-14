import { QtyTypes, VehicleTypes, ChargeTypes, PaymentModes, PaymentMethods, UnitTypes, WeightTypes, PaymentTerms, FuelTypes, FuelPumpPaymentMethod, JobRoles, UserStatuses, VendorPaymentModes, FuelPaymentTransactionMethods, PartyTypes, LiquidationRoles, PaymentPurposes, VehicleStatusList, TripStatusList, PODStatusList, PaymentStatusList } from "./constants";

export type QtyType = typeof QtyTypes[number];
export type VehicleType = typeof VehicleTypes[number];
export type ChargeType = typeof ChargeTypes[number];
export type PaymentMode = typeof PaymentModes[number];
export type PaymentMethod = typeof PaymentMethods[number];
export type UnitType = typeof UnitTypes[number];
export type WeightType = typeof WeightTypes[number];
export type PaymentTerm = typeof PaymentTerms[number];
export type FuelType = typeof FuelTypes[number];
export type FuelPumpPaymentMethod = typeof FuelPumpPaymentMethods[number];
export type JobRole = typeof JobRoles[number];
export type UserStatus = typeof UserStatuses[number];
export type CustomerClientType = 'Consignee' | 'Ship to' | 'Vendor';
export type InvoiceType = string;
export type MasterDataChargeType = string;
export type MasterDataUnitType = string;
export type VendorPaymentMode = typeof VendorPaymentModes[number];
export type PartyType = typeof PartyTypes[number];
export type LiquidationRole = typeof LiquidationRoles[number];
export type PaymentPurpose = typeof PaymentPurposes[number];

// Standardized Operational Status Types
export type VehicleStatus = typeof VehicleStatusList[number];
export type TripStatus = typeof TripStatusList[number];
export type PODStatus = typeof PODStatusList[number];
export type PaymentStatus = typeof PaymentStatusList[number];

export type WithId<T> = T & { id: string };

export type Firm = {
  id: string;
  name: string;
  address: string;
  email: string;
  mobile: string;
  gstin: string;
  pan: string;
  logoUrl?: string;
  createdAt?: any;
};

export type Employee = {
  id: string;
  empId: string; // Formatted ID: SIL0001
  firmId: string; // Linked Firm
  name: string;
  fatherName: string;
  mobile: string;
  department: string;
  designation: string;
  joinDate: any;
  pan: string;
  aadhar: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  status: 'Active' | 'Inactive';
  
  // Salary Structure
  basicSalary: number;
  hra: number;
  conveyance: number;
  specialAllowance: number;
  grossSalary: number;
  
  // Statutory
  pfApplicable: boolean;
  pfPercent: number;
  esiApplicable: boolean;
  esiPercent: number;
  
  netSalary: number;
  
  createdAt?: any;
  updatedAt?: any;
};

export type AdvanceSalary = {
    id: string;
    employeeId: string;
    employeeName: string;
    date: any;
    amount: number;
    paidAmount: number; // For "Pay" action
    balance: number;
    reason: string;
    approvedBy: string;
    status: 'Pending' | 'Deducted' | 'Paid';
    payments?: {
        amount: number;
        date: any;
    }[];
    createdAt?: any;
};

export type PayrollRecord = {
    id: string;
    employeeId: string;
    employeeName: string;
    firmId: string;
    month: string; // YYYY-MM
    basicSalary: number;
    hra: number;
    conveyance: number;
    specialAllowance: number;
    grossSalary: number;
    pfDeduction: number;
    esiDeduction: number;
    advanceDeduction: number;
    netSalary: number;
    
    // Attendance Stats
    workingDays: number;
    totalAttendance: number;
    absentDays: number;

    paidAmount?: number;
    paidDate?: any;
    status: 'Generated' | 'Paid';
    createdAt?: any;
};

export type EmployeeHistory = {
    id: string;
    employeeId: string;
    empId: string;
    employeeName: string;
    workingDate: any;
    totalAttendance: number;
    advanceLeave: number;
    netGrossSalary: number;
    esi: number;
    pf: number;
    netSalary: number;
    advance: number;
    paidSalary: number;
    paidDate?: any;
    balanceSalary: number;
    changeType: string;
    description: string;
    timestamp: any;
    updatedBy: string;
};

export type AttendanceType = 'Full Day' | 'Half Day' | 'Absent' | 'IN (Active)' | 'Holiday' | 'Full Day (Auto-16h)';

export type Attendance = {
  id: string;
  employeeId: string;
  employeeName: string;
  plantId: string;
  inTime: any;
  outTime?: any;
  date: string; // YYYY-MM-DD
  workingHours?: number;
  attendanceType?: AttendanceType;
};

export type BankingAccount = {
    id: string;
    role: LiquidationRole;
    purpose: PaymentPurpose;
    receiverName: string; // Account Holder Name
    paymentMethod: PaymentMethod;
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    branchCity?: string;
    upiId?: string;
    qrCodeUrl?: string;
    limitAmount: number;
    paidAmount?: number;
    createdBy?: string;
    modifiedBy?: string;
    timestamp?: any;
};

export type Shipment = {
    id: string;
    shipmentId: string;
    originPlantId: string;
    destination: string;
    material: string;
    quantity: number;
    materialTypeId: QtyType;
    weight: number;
    shipmentDate: Date;
    currentStatusId: TripStatus;
    creationDate: Date;
    lastUpdateDate?: Date;
    // for UI
    consignor?: string;
    consignorGtin?: string;
    billToParty?: string;
    billToGtin?: string;
    shipToParty?: string;
    shipToGtin?: string;
    unloadingPoint?: string;
    loadingPoint?: string;
    assignedQty: number; // Total assigned so far
    balanceQty: number; // Total remaining
    invoiceNumber?: string;
    ewaybillNumber?: string;
    itemDescription?: string;
    totalUnits?: number;
    lrNumber?: string;
    lrDate?: Date | null;
    carrierId?: string;
    consigneeName?: string;
    cancelledBy?: string;
    cancelledAt?: Date;
    shortClosedBy?: string;
    shortClosedAt?: Date;
    cancelReason?: string;
    restoredBy?: string;
    restoredAt?: Date;
    items?: any[];
    paymentTerm?: string;
    deliveryAddress?: string;
}

export type Trip = {
    id: string;
    tripId: string;
    vehicleId: string;
    driverId: string;
    shipmentIds: string[];
    originPlantId: string;
    destination: string;
    startDate: Date; // Assigned date
    outDate?: Date; // Out for delivery date
    arrivalDate?: Date; // Arrival for delivery date
    estimatedCompletionDate?: Date;
    actualCompletionDate?: Date; // Delivered date
    
    // SIKKA LMC STANDARDIZED STATUS NODES
    tripStatus: TripStatus;
    podStatus: PODStatus;
    freightStatus: PaymentStatus;
    vehicleStatus: VehicleStatus;
    
    // Backwards Compatibility / UI Internal
    currentStatusId: string; 
    
    // POD Verification Node
    podVerifiedBy?: string;
    podVerifiedAt?: any;
    
    previousOperationalStatus?: string; // For Exception recovery
    lastUpdated?: Date;
    lrGenerated: boolean;
    lrNumber?: string;
    lrDate?: Date;
    carrierId?: string;
    podReceived: boolean;
    podUrl?: string; // path to uploaded file
    // for UI
    userName?: string;
    vehicleNumber?: string;
    driverName?: string;
    driverMobile?: string;
    shipToParty?: string;
    unloadingPoint?: string;
    distance?: number; // in KM
    // New fields from assignment
    vehicleType: VehicleType;
    assignedQtyInTrip: number; // Qty assigned specifically in this trip
    transporterName?: string;
    transporterMobile?: string;
    freightRate?: number;
    freightAmount?: number;
    isRateFixed?: boolean;
    // For delivered status
    unloadQty?: number;
    freightId?: string;
    // Freight Process Fields
    isFreightPosted?: boolean;
    freightPostedBy?: string;
    freightPostedAt?: Date;
    advanceAmount?: number;
    freightReceiverName?: string;
    paymentMethod?: PaymentMethod;
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    upiId?: string;
    qrCodeUrl?: string;
    cashAmount?: number;
    payDate?: Date;
    accountHolderName?: string;
    bankingAccounts?: BankingAccount[];
}

export type ShipmentTracking = {
    id: string;
    tripId: string;
    statusId: string;
    location: string;
    timestamp: Date;
    remarks?: string;
};

export type Vehicle = {
    id: string;
    vehicleNumber: string;
    plantId: string;
    driverId: string;
    driverName: string;
    driverMobile: string;
    status: VehicleStatus;
    lastOdometerReading?: number;
    vehicleType?: VehicleType;
    gpsImeiNo?: string;
    gps_provider?: string;
    gps_enabled?: boolean;
    lastGpsUpdate?: any;
};


export type Driver = {
    id: string;
    firstName: string;
    lastName: string;
    contactNumber: string;
}

export type Notification = {
    id: string;
    userId: string;
    userName: string;
    actionType: 'Added' | 'Updated' | 'Cancelled';
    module: string;
    message: string;
    entityId: string;
    plantId: string;
    timestamp: Date;
    isRead: boolean;
    details?: {
      vehicleNumber?: string;
      partyName?: string;
      unloadingPoint?: string;
      qty?: string;
    }
  }

export type StatusUpdate = {
    id: string;
    tripId: string;
    vehicleNumber: string;
    timestamp: Date;
    previousStatus: string;
    previousStatusTimestamp?: Date;
    newStatus: string;
    updatedBy: string; // User ID or name
    remarks?: string;
    // For UI enrichment
    shipToParty?: string;
    unloadingPoint?: string;
    originPlantId?: string;
}

export type Charge = {
    id: string;
    amount: number;
    type: ChargeType | 'Debit';
    remark?: string;
    createdAt: Date;
    debitType?: 'Shortage' | 'Damage' | 'Others';
}

export type Payment = {
    id: string;
    amount: number;
    mode: PaymentMode;
    referenceNo?: string;
    paymentDate: Date;
    targetAccountId?: string; // Linked to a BankingAccount.id
}

export type Freight = {
    id: string;
    tripId: string;
    baseFreightAmount: number;
    charges: WithId<Charge>[];
    payments: WithId<Payment>[];
    totalFreightAmount: number;
    paidAmount: number;
    balanceAmount: number;
    deductions: number;
    paymentStatus: PaymentStatus;
    createdAt: Date;
    lastUpdated: Date;
}

export type Carrier = {
    id: string;
    plantId: string;
    logoUrl: string;
    name: string;
    address: string;
    gstin: string;
    pan: string;
    stateName: string;
    stateCode: string;
    email: string;
    mobile: string;
    website?: string;
    terms: string[];
}

export type LRItem = {
    id: string;
    invoiceNumber: string;
    ewaybillNumber?: string;
    units: number;
    unitType?: string;
    itemDescription: string;
    productDescription?: string;
    weight?: number;
};

export type LR = {
    id: string;
    tripId: string;
    carrierId: string;
    lrNumber: string;
    date: Date;
    from: string;
    to: string;
    paymentTerm: PaymentTerm;
    transportMode: string;
    
    // Weight Selection Logic
    weightSelection: 'Assigned Weight' | 'Actual Weight';
    assignedTripWeight: number; // Total weight from trip
    
    // Multi-row items
    items: LRItem[];
    
    // Header details
    consignorName: string;
    consignorGtin?: string;
    consignorMobile?: string;
    buyerName: string;
    buyerGtin?: string;
    buyerMobile?: string;
    shipToParty: string;
    shipToGtin?: string;
    shipToMobile?: string;
    deliveryAddress: string;

    // Enriched data for display/printing
    trip?: WithId<Trip>;
    carrier?: WithId<Carrier>;
    shipment?: WithId<Shipment>;
    originPlantId?: string;
    tripStatus?: string;
    vehicleNumber?: string;
    driverMobile?: string;
};

export type RejectionShortageItem = {
    id: string;
    product: string;
    unloadedQty: number;
    rejectionQty: number;
    reason: string;
};

export type RejectionShortage = {
    id: string;
    tripId: string;
    rejectionType: 'Rejection' | 'Shortage';
    items: RejectionShortageItem[];
    status: 'Pending' | 'Resolved';
    createdAt: Date;
    resolvedAt?: Date;
    remarks?: string;
};

export type FuelPump = {
  id: string;
  name: string; // Fuel Pump Name
  address?: string;
  ownerName: string;
  mobile: string; // Mobile Number
  gstin?: string;
  pan: string;
  paymentMethod?: FuelPumpPaymentMethod;
  receiverName?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
  qrCodeUrl?: string;
}

export type FuelEntry = {
    id: string;
    slipNo: string;
    date: Date;
    fuelType: FuelType;
    pumpId: string;
    vehicleType: VehicleType;
    userName?: string;
    
    // For Own Vehicle
    vehicleId?: string; // from mockVehicles
    previousReading?: number;
    currentReading?: number;
    distance?: number;
    average?: number;

    // For Contract / Market vehicle
    vehicleNumber?: string; // manual entry for contract/market
    driverName?: string; // optional for contract/market
    ownerName?: string;
    tripDetails?: string;

    // Market Vehicle Extended Particulars
    tripDate?: Date;
    tripDestination?: string;
    weight?: number;
    freight?: number;
    lrNumber?: string;
    lrDate?: Date;

    // Common
    fuelLiters: number;
    fuelRate: number;
    fuelAmount: number;
    fuelSlipImageUrl?: string;
    
    // For UI enrichment
    pumpName?: string;
    vehicleDriverName?: string; // auto-fetched for own, manual for others

    // Payment Details
    paidAmount: number;
    balanceAmount: number;
    paymentStatus: PaymentStatus;
    payments: {
        paymentId: string;
        amount: number;
        date: Date;
        method: typeof FuelPaymentTransactionMethods[number];
        ref?: string;
    }[];
    plantId?: string;
}

export type FuelPayment = {
    id: string;
    pumpId: string;
    fromDate: Date;
    toDate: Date;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    paymentMethod: typeof FuelPaymentTransactionMethods[number];
    bankingRef?: string;
    paymentDate: Date;
    paidBy: string; // username
}

export type InvoicePayment = {
    id: string;
    invoiceId: string;
    migoNumber: string; // 8-digit auto series
    receiptAmount: number;
    actualReceipt?: number;
    tdsAmount: number;
    debitAmount: number;
    debitBrief?: string;
    interestAmount: number;
    remark?: string;
    roundOff?: number;
    balanceAfterPayment: number;
    bankingRef: string; // Bank UTR (Mandatory)
    paymentAdvise?: string;
    paymentDate: Date;
    createdBy: string; // username
    createdAt: any;
}

export type RecycledItem = {
    id: string;
    pageName: string; // 'Fuel Payment', 'Fuel Pump'
    userName: string; // User who deleted it
    deletedAt: Date;
    data: any & { type: 'FuelPump' | 'FuelPayment' | 'Trip' | 'Freight' | 'InvoicePayment' | 'Shipment' | 'Vehicle' | 'Party' | 'Status' | 'QtyType' | 'VehicleEntry' | 'FuelEntry' | 'User' | 'Carrier' | 'Plant' | 'Employee' };
}


export type ShipmentStatusMaster = {
    id: string;
    name: string;
    description: string;
}

export type MasterQtyType = {
  id: string;
  name: string;
}

export type SubUser = {
  id: string;
  fullName: string;
  jobRole: JobRole;
  mobile: string;
  countryCode?: string;
  username: string;
  email?: string;
  password?: string;
  status: UserStatus;
  permissions: string[];
  loginAttempts: number;
  access_logistics: boolean;
  access_accounts: boolean;
  plantIds?: string[]; // Logistics Plants
  accounts_plant_ids?: string[]; // Accounts Plants
  defaultModule?: 'Logistics' | 'Accounts' | 'Administration';
  photoURL?: string;
  passwordUpdatedAt?: any;
  lastPasswordChange?: string;
};

export type OwnVehicle = {
    id: string;
    vehicleNumber: string;
    driverName: string;
    driverMobile: string;
    licenseNumber: string;
    pollutionCertValidity?: Date;
    fitnessCertValidity?: Date;
    permitCertValidity?: Date;
    plantId: string;
    ownerName?: string;
    ownerMobile?: string;
    gpsImeiNo?: string;
};

export type ContractVehicle = {
    id: string;
    vehicleNumber: string;
    driverName: string;
    driverMobile: string;
    licenseNumber: string;
    ownerName: string;
    ownerMobile: string;
    pan: string;
    contractFrom: Date;
    validUpto: Date;
    plantId: string;
};

export type MarketVehicle = {
    id: string;
    vehicleNumber: string;
    driverName: string;
    driverMobile: string;
    licenseNumber: string;
    transporterName: string;
    address?: string;
    transporterMobile: string;
    pan?: string;
    plantId: string;
};

export type Customer = {
    id: string;
    plantId: string;
    clientType: CustomerClientType;
    name: string;
    address: string;
    gstin: string;
    pan: string;
    state: string;
    stateCode: string;
    contactPerson?: string;
    mobile?: string;
    email?: string;
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    upiId?: string;
    qrCodeUrl?: string;
    logoUrl?: string;
};

export type MasterDataItem = {
  id: string;
  plantId: string;
  invoiceTypeId: string;
  chargeTypeId: string;
  itemDescription: string;
  hsnSac: string;
  unitTypeId: string;
  rate: number;
  isGstApplicable: boolean;
  gstRate?: number;
  ota: boolean;
  validFrom?: Date;
  validTo?: Date;
  validityDate?: Date; // Added for One-Time items
  createdBy: string;
  createdAt: Date;
};

export type FreightMaster = {
  id: string;
  plantId: string;
  chargeTypeId: string;
  from: string;
  destination: string;
  rate: number;
  isGstApplicable: boolean;
  gstRate?: number;
  validFrom?: Date;
  validTo?: Date;
  validityDate?: Date; // Added for One-Time items
  ota: boolean;
  createdBy: string;
  createdAt: Date;
  modifiedBy?: string;
  modifiedAt?: Date;
};

export type FreightMasterLog = {
    id: string;
    freightMasterId: string;
    user: string;
    action: 'Created' | 'Modified';
    timestamp: Date;
    changes: string;
};

export type InvoiceItem = {
    masterItemId: string;
    itemDescription: string;
    description?: string;
    hsnSac: string;
    qty: number;
    uom?: string;
    unitType?: MasterDataUnitType;
    rate: number;
    amount: number; // Taxable Amount
    itemCustomValues?: Record<string, string>;
};

export type InvoiceTotals = {
    taxableAmount: number;
    isInterState: boolean;
    igst: number;
    cgst: number;
    sgst: number;
    grandTotal: number;
    roundOff: number;
    amountInWords: string;
};

export type Invoice = {
    id: string;
    invoiceType: InvoiceType;
    isAutoInvoiceNo: boolean;
    invoiceNo: string;
    invoiceNoNumeric?: number;
    invoiceDate: Date;
    lastUpdatedAt?: Date;
    billMonth: string; // "MM/YYYY"
    ackNo?: string;
    ackDate?: Date;
    irn?: string;
    irnGeneratedAt?: Date;
    isPosted?: boolean;
    otaApplicable?: boolean;
    otaDate?: Date;
    qrCodeDataUrl?: string;
    consignorId: string;
    consigneeId: string;
    shipToId?: string;
    isShipToSame?: boolean;
    plantId: string;
    chargeType: MasterDataChargeType;
    docCustomValues?: Record<string, string>;
    docColumns?: string[];
    itemColumns?: string[];
    items: InvoiceItem[];
    totals: InvoiceTotals;
    payments: WithId<InvoicePayment>[];
    paymentStatus: 'Draft' | 'Posted' | 'IRN Updated' | 'Cancelled' | 'Cancelled via Credit Note' | 'Paid' | 'Unpaid' | 'Partly Paid';
    // Cancellation Fields
    cancelReason?: string;
    cancelledAt?: Date;
    cancelledBy?: string;
    originalInvoiceRef?: string; // Linked for Credit Notes
    createdAt: any;
};

export type VendorInvoiceItem = {
    id: string;
    itemDescription: string;
    hsnSac?: string;
    qty: number;
    qtyType: QtyType;
    rate: number;
    amount: number;
};

export type VendorInvoicePayment = {
    id: string;
    invoiceId: string;
    paidAmount: number;
    tdsAmount: number;
    deductionAmount: number;
    deductionReason?: string;
    paymentMode: VendorPaymentMode;
    paymentRefNo?: string;
    paymentDate: Date;
    createdBy: string;
    createdAt: any;
    balanceAfterPayment: number;
};

export type VendorInvoice = {
    id: string;
    invoiceNo: string;
    invoiceDate: Date;
    vendorId: string;
    vendorName: string;
    vendorAddress?: string;
    vendorGstin: string;
    vendorPan: string;
    vendorState: string;
    vendorStateCode: string;
    plantId: string;
    firmDocId: string;
    firmName: string;
    billToPartyName?: string;
    billToPartyAddress?: string;
    billToPartyGstin?: string;
    billToPartyPan?: string;
    billToPartyState?: string;
    billToPartyStateCode?: string;
    items: WithId<VendorInvoiceItem>[];
    taxableAmount: number;
    isGstApplicable: boolean;
    gstRate?: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    gstAmount: number;
    grossAmount: number;
    payableAmount?: number;
    payments: WithId<VendorInvoicePayment>[];
    paymentStatus: 'Open' | 'Partially Paid' | 'Closed' | 'Cancelled';
    invoiceFileUrl?: string;
    docColumns?: string[];
    docCustomValues?: Record<string, any>;
    createdAt: any;
};

export type Activity = {
    id: string;
    userId: string;
    userName: string;
    tcode: string;
    pageName: string;
    action: 'Create' | 'Edit' | 'Delete' | 'View' | 'Export' | 'Create FreightMaster' | 'Change FreightMaster' | 'Login' | 'Logout' | 'Cancel' | 'Cancel Order' | 'Post' | 'Acceptance';
    timestamp: Date;
    description: string;
    previousScreen?: string;
    ip?: string;
};

export type PlantFormValues = {
  name: string;
  consignorName: string;
  logo?: FileList;
  address: string;
  postalCode: string;
  gstin: string;
  pan: string;
  state: string;
  stateCode: string;
  country: string;
  mobile: string;
  email: string;
  website: string;
  terms?: { value: string }[];
};
    
export type UploadLog = {
  id: string;
  tcode: string;
  timestamp: Date;
  userName: string;
  totalRecords: number;
  status: string;
}

export type MasterInvoiceType = {
  id: string;
  plantId: string;
  name: string;
};

export type MasterChargeType = {
  id: string;
  plantId: string;
  name: string;
};

export type MasterUnitType = {
  id: string;
  plantId: string;
  name: string;
};

// This type seems to be unused now, but we will keep it for reference.
export type LRProduct = {
  id: string;
  units: number;
  unitType: UnitType;
  description: string;
  weight: number;
  weightType: WeightType;
  goodsValue?: number;
}
