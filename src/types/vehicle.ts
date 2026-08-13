export interface VehicleEntry {
  id: string;
  plant: string;
  vehicleNo: string;
  driverName: string;
  driverMobile: string;
  inDateTime: string;
  outDateTime?: string;
  currentStatus: 'IN' | 'OUT' | 'Loaded Stay' | 'Empty Stay' | 'Under Maintenance';
  [key: string]: any; // Allow other properties
}