
import { adminAuth, adminDb, FieldValue, config as firebaseConfig } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    let action = 'unknown';
    try {
        const body = await req.json();
        action = body.action;
        const { email, password, username, uid, mobileNo, userId, newPassword } = body;

        if (action === 'resolveEmail') {
            if (!username) {
                return NextResponse.json({ error: "Username required." }, { status: 400 });
            }

            const cleanUsername = username.toLowerCase().trim();
            try {
                let snap;
                try {
                    const q = adminDb.collection("users").where("username", "==", cleanUsername).limit(1);
                    snap = await q.get();
                } catch (fsError: any) {
                    if (fsError.message?.includes('PERMISSION_DENIED') || fsError.code === 7) {
                        console.log("resolveEmail: Attempting fallback to (default) database...");
                        const { getFirestore: getFs } = await import('firebase-admin/firestore');
                        const defaultDb = getFs(adminAuth.app);
                        const q = defaultDb.collection("users").where("username", "==", cleanUsername).limit(1);
                        snap = await q.get();
                    } else {
                        throw fsError;
                    }
                }

                if (snap.empty) {
                    const fallbackEmail = cleanUsername === 'sikkaind' ? 'sikkaind.admin@sikka.com' : `${cleanUsername}@sikka.com`;
                    return NextResponse.json({ success: true, email: fallbackEmail });
                }

                const userData = snap.docs[0].data();
                return NextResponse.json({ success: true, email: userData.email });
            } catch (error: any) {
                console.error("resolveEmail Error:", error);
                throw error;
            }
        }

        if (action === 'verifyUser') {
            if (!username || !mobileNo) {
                return NextResponse.json({ error: "Username and mobile number required." }, { status: 400 });
            }

            const cleanUsername = username.toLowerCase().trim();
            try {
                let snap;
                try {
                    const q = adminDb.collection("users")
                        .where("username", "==", cleanUsername)
                        .where("mobileNo", "==", mobileNo.trim())
                        .limit(1);
                    snap = await q.get();
                } catch (fsError: any) {
                    if (fsError.message?.includes('PERMISSION_DENIED') || fsError.code === 7) {
                        console.log("verifyUser: Attempting fallback to (default) database...");
                        const { getFirestore: getFs } = await import('firebase-admin/firestore');
                        const defaultDb = getFs(adminAuth.app);
                        const q = defaultDb.collection("users")
                            .where("username", "==", cleanUsername)
                            .where("mobileNo", "==", mobileNo.trim())
                            .limit(1);
                        snap = await q.get();
                    } else {
                        throw fsError;
                    }
                }

                if (snap.empty) {
                    return NextResponse.json({ error: "INVALID USERNAME OR INVALID NO." }, { status: 404 });
                }

                const userData = snap.docs[0].data();
                return NextResponse.json({ success: true, userId: snap.docs[0].id, email: userData.email });
            } catch (error: any) {
                console.error("verifyUser Error:", error);
                throw error;
            }
        }

        if (action === 'resetPassword') {
            if (!userId || !newPassword) {
                return NextResponse.json({ error: "User ID and new password required." }, { status: 400 });
            }

            const userRef = adminDb.collection("users").doc(userId);
            const userSnap = await userRef.get();

            if (!userSnap.exists) {
                return NextResponse.json({ error: "User not found." }, { status: 404 });
            }

            const userData = userSnap.data()!;
            const email = userData.email || (userData.username === 'sikkaind' ? 'sikkaind.admin@sikka.com' : `${userData.username}@sikka.com`);

            await userRef.update({
                password: newPassword,
                passwordUpdatedAt: FieldValue.serverTimestamp(),
            });

            const userRecord = await adminAuth.getUserByEmail(email);
            await adminAuth.updateUser(userRecord.uid, {
                password: newPassword
            });

            return NextResponse.json({ success: true, message: "Password reset successfully." });
        }

        if (action === 'bootstrap') {
            const adminUsername = 'sikkaind';
            const adminEmail = 'sikkaind.admin@sikka.com';
            const adminPassword = 'sikkaind';

            try {
                let uid;
                try {
                    const existing = await adminAuth.getUserByEmail(adminEmail);
                    uid = existing.uid;
                    await adminAuth.updateUser(uid, { password: adminPassword });
                } catch (e: any) {
                    if (e.code === 'auth/user-not-found') {
                        const created = await adminAuth.createUser({
                            email: adminEmail,
                            password: adminPassword,
                            emailVerified: true,
                            displayName: 'Sikka Admin'
                        });
                        uid = created.uid;
                    } else {
                        throw e;
                    }
                }

                const userDocRef = adminDb.collection("users").doc(adminEmail);
                await userDocRef.set({
                    username: adminUsername,
                    fullName: 'Sikka Admin',
                    email: adminEmail,
                    jobRole: 'Admin',
                    status: 'Active',
                    plantId: '1426',
                    createdAt: FieldValue.serverTimestamp(),
                    id: adminEmail
                }, { merge: true });

                return NextResponse.json({ success: true, message: "Admin account bootstrapped." });
            } catch (error: any) {
                return NextResponse.json({ 
                    error: `Bootstrap failed: ${error.message}`
                }, { status: 500 });
            }
        }

        if (action === 'updatePassword') {
            if (!email || !password) {
                return NextResponse.json({ error: "Email and password required." }, { status: 400 });
            }

            const userRecord = await adminAuth.getUserByEmail(email);
            await adminAuth.updateUser(userRecord.uid, {
                password: password
            });

            return NextResponse.json({ success: true, message: "Auth password updated." });
        }

        if (action === 'createUser') {
            if (!email || !password) {
                return NextResponse.json({ error: "Email and password required." }, { status: 400 });
            }

            try {
                const existingUser = await adminAuth.getUserByEmail(email);
                await adminAuth.updateUser(existingUser.uid, {
                    password: password
                });
                return NextResponse.json({ success: true, message: "Existing user password updated.", uid: existingUser.uid });
            } catch (e: any) {
                if (e.code === 'auth/user-not-found') {
                    const userRecord = await adminAuth.createUser({
                        email: email,
                        password: password,
                        emailVerified: true
                    });
                    return NextResponse.json({ success: true, message: "User created in Auth.", uid: userRecord.uid });
                }
                throw e;
            }
        }

        return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ 
            error: error.message || "Internal Server Error",
        }, { status: 500 });
    }
}
