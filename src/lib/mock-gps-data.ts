import type { WithId, Vehicle } from '@/types';

export const mockGpsData: WithId<Vehicle>[] = [
  {
    id: '1',
    vehicleNumber: 'HR38Z9925',
    latitude: 28.6139,
    longitude: 77.2090,
    driverName: 'John Doe',
    driverMobile: '1234567890',
    vehicleType: 'Own Vehicle',
    status: 'in-transit',
    speed: 60,
    ignition: true,
    angle: 45,
    location: 'Delhi, India'
  },
  {
    id: '2',
    vehicleNumber: 'DL1C1234',
    latitude: 28.5355,
    longitude: 77.3910,
    driverName: 'Jane Smith',
    driverMobile: '0987654321',
    vehicleType: 'Contract Vehicle',
    status: 'available',
    speed: 0,
    ignition: false,
    angle: 90,
    location: 'Noida, India'
  },
];
