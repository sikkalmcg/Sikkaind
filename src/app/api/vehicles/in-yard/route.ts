import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
const COLLECTION = 'users__Sikkaind__vehicle_movements';

function toClientDocument(document: Record<string, unknown>) {
  const { _id, ...data } = document;
  return { id: String(_id), ...data };
}

export async function GET(request: NextRequest) {
  try {
    const plant = request.nextUrl.searchParams.get('plant');
    if (!plant) return NextResponse.json({ error: 'Plant is required.' }, { status: 400 });

    const vehicles = await (await connectDB()).collection<Record<string, unknown>>(COLLECTION)
      .find({ plant, currentStatus: { $ne: 'OUT' }, outDateTime: { $in: [null, ''] } })
      .sort({ inDateTime: -1 })
      .toArray();
    return NextResponse.json(vehicles.map(toClientDocument));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to load vehicles.' }, { status: 500 });
  }
}
