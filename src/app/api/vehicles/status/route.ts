import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
const COLLECTION = 'users__Sikkaind__vehicle_movements';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    if (!data.plant || !data.vehicleNo || !data.currentStatus || !data.statusDateTime || !data.remark) {
      return NextResponse.json({ message: 'Plant, vehicle, status, time and remark are required.' }, { status: 400 });
    }

    const collection = (await connectDB()).collection<any>(COLLECTION);
    const vehicle = await collection.findOne({ plant: data.plant, vehicleNo: data.vehicleNo, currentStatus: { $ne: 'OUT' }, outDateTime: { $in: [null, ''] } });
    if (!vehicle) return NextResponse.json({ message: 'Active vehicle entry not found.' }, { status: 404 });

    const history = [...(Array.isArray(vehicle.statusHistory) ? vehicle.statusHistory : []), {
      id: Date.now(), currentStatus: data.currentStatus, statusDateTime: data.statusDateTime, remark: data.remark,
    }];
    await collection.updateOne(
      { _id: vehicle._id },
      {
        $set: {
          currentStatus: data.currentStatus,
          statusDateTime: data.statusDateTime,
          customer: data.customer || '',
          shipToParty: data.shipToParty || '',
          destination: data.destination || '',
          remark: data.remark,
          statusHistory: history,
          updatedAt: new Date(),
        },
      },
    );
    return NextResponse.json(history);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Unable to update vehicle status.' }, { status: 500 });
  }
}
