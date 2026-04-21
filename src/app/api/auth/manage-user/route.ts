import { adminAuth, adminDb, FieldValue } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * @fileOverview Identity Provisioning Terminal.
 * Performs authorized handshake with the Identity Platform and Firestore registry.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, email, password, userData } = body;

        if (action === 'createUser') {
            if (!email || !password) {
                return NextResponse.json({ error: "Email and password node required." }, { status: 400 });
            }

            try {
                // 1. Establish Identity node in Authentication
                let userRecord;
                try {
                    // Check if identity exists
                    userRecord = await adminAuth.getUserByEmail(email);
                    // Update password if identity exists to match mission manifest
                    await adminAuth.updateUser(userRecord.uid, { password });
                } catch (e: any) {
                    if (e.code === 'auth/user-not-found') {
                        userRecord = await adminAuth.createUser({
                            email,
                            password,
                            displayName: userData?.fullName || 'New Operator',
                            emailVerified: true
                        });
                    } else throw e;
                }

                const uid = userRecord.uid;

                // 2. Synchronize Identity node with Firestore Registry
                // This ensures the database write happens in the same authorized context
                const userRegistryRef = adminDb.collection("users").doc(uid);
                await userRegistryRef.set({
                    ...userData,
                    uid,
                    email,
                    status: 'Active',
                    updatedAt: FieldValue.serverTimestamp(),
                    createdAt: FieldValue.serverTimestamp()
                }, { merge: true });

                // 3. Register Administrative Privileges if applicable
                if (userData.jobRole === 'Admin' || userData.jobRole === 'Manager') {
                    await adminDb.collection("roles_admin").doc(uid).set({
                        email,
                        grantedAt: FieldValue.serverTimestamp()
                    });
                }

                return NextResponse.json({ success: true, uid });

            } catch (authError: any) {
                console.error("Identity Handshake Failure:", authError);
                return NextResponse.json({ error: authError.message }, { status: 500 });
            }
        }

        return NextResponse.json({ error: "Invalid mission action." }, { status: 400 });

    } catch (error: any) {
        console.error("Terminal Synchronization Error:", error);
        return NextResponse.json({ error: "Terminal synchronization error." }, { status: 500 });
    }
}
