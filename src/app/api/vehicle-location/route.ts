export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";

/**
 * @fileOverview API Route for Fleet Visibility.
 * Satisfies SSG requirements for static export.
 */

export async function GET() {
  return NextResponse.json({ 
    message: "Registry baseline node. Dynamic export active.",
    data: [] 
  });
}