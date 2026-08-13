import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
const COLLECTION = 'users__Sikkaind__vehicle_movements';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    if (!data.plant || !data.vehicleNo || !data.exitDateTime || !data.outType) {
      return NextResponse.json({ message: 'Plant, vehicle, exit time and out type are required.' }, { status: 400 });
    }

    const result = await (await connectDB()).collection(COLLECTION).updateOne(
      { plant: data.plant, vehicleNo: data.vehicleNo, currentStatus: { $ne: 'OUT' }, outDateTime: { $in: [null, ''] } },
      { $set: { currentStatus: 'OUT', outType: data.outType, outDateTime: data.exitDateTime, cnRows: data.cnRows || [], updatedAt: new Date() } },
    );
    if (!result.matchedCount) return NextResponse.json({ message: 'Active vehicle entry not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Unable to mark vehicle OUT.' }, { status: 500 });
  }
}
