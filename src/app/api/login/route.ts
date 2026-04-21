
import { adminDb as db, FieldValue } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";
import type { SubUser } from "@/types";

/**
 * @fileOverview Login API Route.
 * Performs session establishment and identity resolution.
 * Wrapped in try/catch to ensure JSON response nodes.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { uid, email } = body;

        if (!uid) {
            return NextResponse.json({ error: "UID must be provided." }, { status: 400 });
        }

        // Registry Handshake: Resolve by UID or Email
        let userSnap = await db.collection("users").doc(uid).get();
        
        if (!userSnap.exists && email) {
            userSnap = await db.collection("users").doc(email).get();
        }

        if (!userSnap.exists) {
            // New user node: Default to module selection
            return NextResponse.json({ redirect: '/modules' });
        }

        const profile = userSnap.data() as SubUser;
        
        // Audit Node: Log activity
        try {
            await db.collection("activity_logs").add({
                userId: uid,
                userName: profile.fullName || profile.username || email,
                action: 'Login',
                tcode: 'SYS_AUTH',
                pageName: 'Login Registry',
                timestamp: FieldValue.serverTimestamp(),
                description: `Session established for @${profile.username}.`
            });
        } catch (logErr) {
            console.warn("Audit logging pulse failed, but proceeding with login.");
        }

        const accessible = [];
        if (profile.access_logistics) accessible.push('/dashboard');
        if (profile.access_accounts) accessible.push('/sikka-accounts/dashboard');
        
        const isAdmin = profile.jobRole === 'Manager' || profile.jobRole === 'Admin' || profile.username?.toLowerCase() === 'sikkaind';
        if (isAdmin) accessible.push('/user-management');

        // Resolve Default Terminal based on profile registry
        if (profile.defaultModule === 'Logistics' && profile.access_logistics) return NextResponse.json({ redirect: '/dashboard' });
        if (profile.defaultModule === 'Administration' && isAdmin) return NextResponse.json({ redirect: '/user-management' });

        const redirect = accessible.length === 1 ? accessible[0] : '/modules';
        return NextResponse.json({ redirect });
    } catch (e: any) {
        console.error("Login API Crash:", e);
        return NextResponse.json({ error: `Registry Internal Error: ${e.message}`, redirect: '/login' }, { status: 500 });
    }
}
