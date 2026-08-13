import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

const PLANTS_COLLECTION = 'users__Sikkaind__plants';

function toClientDocument(document: Record<string, unknown>) {
  const { _id, ...data } = document;
  return { id: String(_id), ...data };
}

export async function GET(request: NextRequest) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    const filter = includeInactive ? {} : { status: 'Active' };
    const plants = await (await connectDB())
      .collection<Record<string, unknown>>(PLANTS_COLLECTION)
      .find(filter)
      .sort({ plantCode: 1 })
      .toArray();

    return NextResponse.json(plants.map(toClientDocument));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to load plants.' }, { status: 500 });
  }
}
