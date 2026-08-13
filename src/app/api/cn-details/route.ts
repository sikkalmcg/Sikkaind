import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
const COLLECTION = 'users__Sikkaind__sales_orders';

export async function GET(request: NextRequest) {
  try {
    const cnNumber = request.nextUrl.searchParams.get('cn')?.trim();
    if (!cnNumber) return NextResponse.json({ message: 'CN number is required.' }, { status: 400 });

    const order = await (await connectDB()).collection<any>(COLLECTION).findOne({
      $or: [{ cnNumber }, { cnNo: cnNumber }, { consignmentNumber: cnNumber }],
    });
    if (!order) return NextResponse.json({ message: 'CN Number is invalid or not found.' }, { status: 404 });

    return NextResponse.json({
      cnDate: order.cnDate || order.orderDate || '',
      shipToParty: order.shipToParty || order.customerName || '',
      destination: order.destination || order.destinationName || '',
      totalPackage: order.totalPackage || order.packageCount || '',
      totalWeight: order.totalWeight || order.weight || '',
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Unable to load CN details.' }, { status: 500 });
  }
}
