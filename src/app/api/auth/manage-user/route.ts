import { adminAuth as auth, adminDb as db, FieldValue } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * @fileOverview Atomic Identity Provisioning API.
 * Hardened for Sikka LMC v2.5 Registry standards.
 * Optimized for high-reliability creation and update pulses.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, email, password, userData } = body;

        // REGISTRY HANDSHAKE Node: Verify SDK authorization pulse
        if (!auth || !db) {
            return NextResponse.json({ 
                error: "Security Node Offline: Admin handshake failed. Verify Service Account and .env.local configuration." 
            }, { status: 503 });
        }

        // AUTH NODE: PROVISION NEW USER + SYNC REGISTRY
        if (action === 'createUser') {
            if (!email || !password) return NextResponse.json({ error: "Missing required fields: Email and Password mandatory." }, { status: 400 });
            
            let uid;
            try {
                // Attempt to resolve existing identity node (Idempotent check)
                const existing = await auth.getUserByEmail(email);
                // Update password if it already exists to ensure registry sync
                await auth.updateUser(existing.uid, { password });
                uid = existing.uid;
            } catch (e: any) {
                if (e.code === 'auth/user-not-found') {
                    // Initialize new identity node
                    const created = await auth.createUser({ 
                        email, 
                        password, 
                        emailVerified: true,
                        displayName: userData?.fullName || email.split('@')[0]
                    });
                    uid = created.uid;
                } else {
                    console.error("Auth Handshake Error:", e);
                    throw new Error(`Auth Node Error: ${e.message}`);
                }
            }

            // Sync with Firestore User Registry
            const userRef = db.collection("users").doc(email);
            const finalUserData = {
                ...userData,
                uid,
                email,
                status: 'Active',
                createdAt: FieldValue.serverTimestamp(),
                lastUpdated: FieldValue.serverTimestamp()
            };
            await userRef.set(finalUserData, { merge: true });

            return NextResponse.json({ success: true, uid });
        }

        // AUTH NODE: AUTHORIZED PASSWORD RESET
        if (action === 'resetPassword') {
            if (!email || !password) return NextResponse.json({ error: "Registry context missing." }, { status: 400 });
            
            // Resolve UID from email registry
            try {
                const authUser = await auth.getUserByEmail(email);
                await auth.updateUser(authUser.uid, { password });
                
                // Update Firestore password record for offline/fallback access
                const userDoc = await db.collection("users").doc(email).get();
                if (userDoc.exists) {
                    await userDoc.ref.update({ 
                        password, 
                        lastPasswordChange: new Date().toISOString(),
                        lastUpdated: FieldValue.serverTimestamp()
                    });
                }
                
                return NextResponse.json({ success: true });
            } catch (authErr: any) {
                console.error("Password Update Error:", authErr);
                throw new Error(`Identity Platform Update Failed: ${authErr.message}`);
            }
        }

        // AUTH NODE: BOOTSTRAP ROOT ADMIN
        if (action === 'bootstrap') {
            const adminEmail = 'sikkaind.admin@sikka.com';
            const adminPassword = 'Sikka@lmc2105';

            let uid;
            try {
                const existing = await auth.getUserByEmail(adminEmail);
                uid = existing.uid;
                await auth.updateUser(uid, { password: adminPassword });
            } catch (e: any) {
                const created = await auth.createUser({
                    email: adminEmail,
                    password: adminPassword,
                    emailVerified: true,
                    displayName: 'Sikka Admin'
                });
                uid = created.uid;
            }

            await db.collection("users").doc(adminEmail).set({
                username: 'sikkaind',
                fullName: 'Sikka Admin',
                email: adminEmail,
                password: adminPassword,
                jobRole: 'Admin',
                status: 'Active',
                plantIds: ['1426'],
                access_logistics: true,
                access_accounts: true,
                createdAt: FieldValue.serverTimestamp(),
                uid: uid
            }, { merge: true });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid mission action node." }, { status: 400 });
    } catch (error: any) {
        console.error("Identity Registry Failure:", error);
        return NextResponse.json({ 
            error: error.message || "Identity Registry Pulse Failure.",
            code: error.code || 'UNKNOWN'
        }, { status: 500 });
    }
}
