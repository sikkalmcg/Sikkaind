
const admin = require('firebase-admin');

/**
 * @fileOverview User Registry Synchronization Script.
 * Hardened to match v2.5 server-side handshake nodes.
 */

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "studio-2134942499-abd6c"
    });
}

const db = admin.firestore();
const auth = admin.auth();

async function syncUsers() {
  console.log('--- STARTING MISSION REGISTRY SYNC ---');

  try {
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('Registry Node Empty: No users found in database.');
      return;
    }

    console.log(`Pulse Active: Processing ${usersSnapshot.docs.length} identity nodes.`);

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const { email, password, fullName, uid: storedUid } = userData;

      if (!email || !password) {
        console.warn(`Registry Skip: Node ${userDoc.id} missing mandatory particulars.`);
        continue;
      }

      try {
        // Handshake: Verify Identity Platform link
        const authUser = await auth.getUserByEmail(email);
        console.log(`Identity Confirmed: ${email} active at ${authUser.uid}`);
        
        // Ensure UID synchronization in Database
        if (storedUid !== authUser.uid) {
            await userDoc.ref.update({ uid: authUser.uid });
            console.log(`Registry Handshake: Synchronized UID for ${email}`);
        }
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          // Provision missing identity node
          try {
            const userRecord = await auth.createUser({
              email: email,
              password: password,
              displayName: fullName,
              emailVerified: true
            });
            await userDoc.ref.update({ uid: userRecord.uid });
            console.log(`Node Established: Successfully provisioned ${userRecord.uid} (${email})`);
          } catch (createError) {
            console.error(`Provisioning Failure for ${email}:`, createError.message);
          }
        } else {
          console.error(`Sync Conflict for ${email}:`, error.message);
        }
      }
    }

    console.log('--- MISSION REGISTRY SYNC COMPLETE ---');
  } catch (error) {
    console.error("FATAL: Registry Extraction Failure", error);
  }
}

syncUsers();
