
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK using Application Default Credentials
// This bypasses the need for a local JSON file which might be invalid/deleted
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "studio-2134942499-abd6c"
    });
}

const db = admin.firestore();
const auth = admin.auth();

async function syncUsers() {
  console.log('Starting user synchronization...');

  try {
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('No users found in the Firestore database.');
      return;
    }

    console.log(`Found ${usersSnapshot.docs.length} users in Firestore.`);

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const { email, password, fullName } = userData;

      if (!email || !password) {
        console.warn(`Skipping user ${userDoc.id} due to missing email or password.`);
        continue;
      }

      try {
        // Check if user already exists in Firebase Authentication
        await auth.getUserByEmail(email);
        console.log(`User with email ${email} already exists in Firebase Authentication. Skipping.`);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          // User does not exist, so create them
          try {
            const userRecord = await auth.createUser({
              email: email,
              password: password,
              displayName: fullName,
            });
            console.log(`Successfully created new user: ${userRecord.uid} (${email})`);
          } catch (createError) {
            console.error(`Error creating user ${email}:`, createError);
          }
        } else {
          // Some other error occurred
          console.error(`Error checking user ${email}:`, error);
        }
      }
    }

    console.log('User synchronization completed.');
  } catch (error) {
    console.error('Error fetching users from Firestore:', error);
  }
}

syncUsers();
