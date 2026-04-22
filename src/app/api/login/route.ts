
import { adminDb as db, FieldValue } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";
import type { SubUser } from "@/types";

/**
 * @fileOverview Login Audit API.
 * Logs successful session establishment.
 * Verification logic migrated to client for increased reliability.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { uid, email, profile } = body;

        if (!uid || !db) {
            return NextResponse.json({ success: true, message: "Registry audit skipped: Admin node offline." });
        }

        // Audit Node: Log activity in background
        try {
            await db.collection("activity_logs").add({
                userId: uid,
                userName: profile?.fullName || email,
                action: 'Login',
                tcode: 'SYS_AUTH',
                pageName: 'Login Registry',
                timestamp: FieldValue.serverTimestamp(),
                description: `Session established for @${profile?.username || email}.`
            });
        } catch (logErr) {
            console.warn("Audit logging pulse failed.");
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Login API Crash:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
