import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await connectDB();
    const vehicles = await db
      .collection('vt01_vehicles')
      .find({})
      .sort({ inDateTime: -1 }) // Sort by most recent entries first
      .toArray();

    return NextResponse.json(vehicles);
  } catch (error) {
    console.error('Failed to fetch vehicle records:', error);
    return NextResponse.json(
      { message: 'Failed to fetch vehicle records', error: (error as Error).message },
      { status: 500 }
    );
  }
}