import { adminAuth as auth, adminDb as db, FieldValue } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * @fileOverview Atomic Identity Provisioning API.
 * Hardened for Sikka LMC v2.5 Registry standards.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, email, password, userData, username, mobile } = body;

        // REGISTRY HANDSHAKE Node: Verify SDK authorization pulse
        if (!auth || !db) {
            return NextResponse.json({ 
                error: "Security Node Offline: Cloud Admin handshake failed. Please ensure the project ID is correctly mapped." 
            }, { status: 503 });
        }

        // AUTH NODE: PROVISION NEW USER + SYNC REGISTRY
        if (action === 'createUser') {
            if (!email || !password) return NextResponse.json({ error: "Missing required fields: Email and Password mandatory." }, { status: 400 });
            
            let uid;
            try {
                // Attempt to resolve existing identity node
                const existing = await auth.getUserByEmail(email);
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
                    throw e;
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
            
            const q = await db.collection("users").where("email", "==", email).limit(1).get();
            if (q.empty) return NextResponse.json({ error: "Identity node not found in registry." }, { status: 404 });

            const userDoc = q.docs[0];
            const uid = userDoc.data().uid;

            if (uid) {
                await auth.updateUser(uid, { password });
                await userDoc.ref.update({ 
                    password, 
                    lastPasswordChange: new Date().toISOString(),
                    lastUpdated: FieldValue.serverTimestamp()
                });
                return NextResponse.json({ success: true });
            }
            throw new Error("UID handshake failed. Identity context corrupted.");
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
            error: `Identity Registry Error: ${error.message}`,
            code: error.code
        }, { status: 500 });
    }
}
