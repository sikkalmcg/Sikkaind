import { adminAuth, adminDb, FieldValue } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * @fileOverview Identity Provisioning Terminal (Server-Side).
 * Consolidates Authentication identity establishment and Firestore registry write.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, email, password, userData } = body;

        if (action === 'createUser') {
            if (!email || !password) {
                return NextResponse.json({ error: "Credentials manifest required." }, { status: 400 });
            }

            try {
                // 1. Establish Identity node in Authentication
                let userRecord;
                try {
                    userRecord = await adminAuth.getUserByEmail(email);
                    // Update credentials to match the provisioning request
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

                // 2. Atomic Registry Write (Server-Side Handshake)
                // This ensures the user is in the database even if client-side rules are restrictive
                const userRegistryRef = adminDb.collection("users").doc(uid);
                await userRegistryRef.set({
                    ...userData,
                    uid,
                    email,
                    status: 'Active',
                    updatedAt: FieldValue.serverTimestamp(),
                    createdAt: userData.createdAt || FieldValue.serverTimestamp()
                }, { merge: true });

                // 3. Register Administrative Nodes
                if (userData.jobRole === 'Admin' || userData.jobRole === 'Manager') {
                    await adminDb.collection("roles_admin").doc(uid).set({
                        email,
                        grantedAt: FieldValue.serverTimestamp()
                    });
                } else {
                    await adminDb.collection("roles_admin").doc(uid).delete().catch(() => {});
                }

                return NextResponse.json({ success: true, uid });

            } catch (authError: any) {
                console.error("Identity Handshake Failure:", authError);
                return NextResponse.json({ error: authError.message }, { status: 500 });
            }
        }

        return NextResponse.json({ error: "Invalid mission action." }, { status: 400 });

    } catch (error: any) {
        console.error("Provisioning Terminal Error:", error);
        return NextResponse.json({ error: "Terminal synchronization failure." }, { status: 500 });
    }
}
