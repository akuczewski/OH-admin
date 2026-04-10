import * as admin from 'firebase-admin';

// Load Firebase credentials
const serviceAccountPath = './config/firebase-service-account.json';
if (!process.env.FIREBASE_CREDENTIALS && !require('fs').existsSync(serviceAccountPath)) {
  console.log('No firebase credentials. Provide path or setup env variables.');
  process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(require('.' + serviceAccountPath)), // Local path relative to script/runner
    });
}

const db = admin.firestore();

async function clearFirebaseRecipes() {
    console.log('Clearing recipes from Firebase...');
    const snapshot = await db.collection('recipes').get();
    let batch = db.batch();
    let count = 0;
    
    for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        count++;
        if (count % 400 === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }
    
    if (count % 400 !== 0) {
        await batch.commit();
    }
    
    console.log(`Deleted ${count} recipes from Firebase.`);
}

async function run() {
    try {
        await clearFirebaseRecipes();
        // Strapi API deletion should ideally be done through Strapi UI or another script locally
        // Because Strapi is not running during this standalone script, and we cannot import strapi directly here elegantly.
        // We will do strapi deletion manually or through script.
        console.log('Done!');
        process.exit(0);
    } catch (e) {
        console.error('Error clearing recipes:', e);
        process.exit(1);
    }
}

run();
