import { adminAuth, adminDb, FieldValue } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * @fileOverview Atomic Identity Provisioning API.
 * Performs authorized server-side handshake for Auth + Firestore + Security Roles.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, email, password, userData } = body;

        // AUTH NODE: PROVISION NEW USER + SYNC REGISTRY
        if (action === 'createUser') {
            if (!email || !password) return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
            
            try {
                let uid;
                // 1. Establish Identity Node
                try {
                    const existing = await adminAuth.getUserByEmail(email);
                    await adminAuth.updateUser(existing.uid, { password });
                    uid = existing.uid;
                } catch (e: any) {
                    if (e.code === 'auth/user-not-found') {
                        const created = await adminAuth.createUser({ 
                            email, 
                            password, 
                            emailVerified: true,
                            displayName: userData?.fullName || email.split('@')[0]
                        });
                        uid = created.uid;
                    } else throw e;
                }

                // 2. Synchronize Firestore Registry
                const userRef = adminDb.collection("users").doc(email);
                const finalUserData = {
                    ...userData,
                    uid,
                    email,
                    status: 'Active',
                    createdAt: FieldValue.serverTimestamp(),
                    lastUpdated: FieldValue.serverTimestamp()
                };
                await userRef.set(finalUserData, { merge: true });

                // 3. Authorization Node: Grant Admin Privileges if required
                if (userData?.jobRole === 'Admin' || userData?.jobRole === 'Manager' || userData?.username === 'sikkaind') {
                    await adminDb.collection("roles_admin").doc(uid).set({
                        email,
                        role: userData.jobRole || 'Admin',
                        authorizedAt: FieldValue.serverTimestamp()
                    });
                }

                return NextResponse.json({ success: true, uid });
            } catch (error: any) {
                console.error("Provisioning failure:", error);
                return NextResponse.json({ error: `Identity Registry Error: ${error.message}` }, { status: 500 });
            }
        }

        // AUTH NODE: BOOTSTRAP ROOT ADMIN
        if (action === 'bootstrap') {
            const adminEmail = 'sikkaind.admin@sikka.com';
            const adminPassword = 'sikkaind';

            try {
                let uid;
                try {
                    const existing = await adminAuth.getUserByEmail(adminEmail);
                    uid = existing.uid;
                    await adminAuth.updateUser(uid, { password: adminPassword });
                } catch (e: any) {
                    const created = await adminAuth.createUser({
                        email: adminEmail,
                        password: adminPassword,
                        emailVerified: true,
                        displayName: 'Sikka Admin'
                    });
                    uid = created.uid;
                }

                // Sync profile
                await adminDb.collection("users").doc(adminEmail).set({
                    username: 'sikkaind',
                    fullName: 'Sikka Admin',
                    email: adminEmail,
                    jobRole: 'Admin',
                    status: 'Active',
                    plantIds: ['1426'],
                    createdAt: FieldValue.serverTimestamp(),
                    uid: uid
                }, { merge: true });

                // Sync security role
                await adminDb.collection("roles_admin").doc(uid).set({
                    email: adminEmail,
                    role: 'Admin',
                    authorizedAt: FieldValue.serverTimestamp()
                });

                return NextResponse.json({ success: true });
            } catch (error: any) {
                console.error("Bootstrap failure:", error);
                return NextResponse.json({ error: `Bootstrap Error: ${error.message}` }, { status: 500 });
            }
        }

        return NextResponse.json({ error: "Invalid action node." }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
