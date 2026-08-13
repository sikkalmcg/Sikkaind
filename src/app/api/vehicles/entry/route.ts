import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { isValidMobileNumber, validateAndFormatVehicleNumber } from '@/lib/validation';

export const dynamic = 'force-dynamic';
const COLLECTION = 'users__Sikkaind__vehicle_movements';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const vehicleNo = validateAndFormatVehicleNumber(data.vehicleNo || '');
    if (!data.plant || !data.inDateTime || !data.driverName || !vehicleNo) {
      return NextResponse.json({ message: 'All vehicle entry fields are required.' }, { status: 400 });
    }
    if (!isValidMobileNumber(data.driverMobile || '')) {
      return NextResponse.json({ message: 'Mobile number must be exactly 10 digits.' }, { status: 400 });
    }

    const collection = (await connectDB()).collection(COLLECTION);
    const alreadyInYard = await collection.findOne({ vehicleNo, currentStatus: { $ne: 'OUT' }, outDateTime: { $in: [null, ''] } });
    if (alreadyInYard) {
      return NextResponse.json({ message: `Vehicle ${vehicleNo} is already IN.` }, { status: 409 });
    }

    const id = randomUUID();
    await collection.insertOne({ _id: id, ...data, vehicleNo, currentStatus: 'IN', createdAt: new Date() });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Unable to save vehicle entry.' }, { status: 500 });
  }
}
