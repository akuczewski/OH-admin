import dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

let pk = process.env.FIREBASE_PRIVATE_KEY || '';
if (pk.startsWith('"') && pk.endsWith('"')) pk = pk.slice(1, -1);
pk = pk.replace(/\\n/g, '\n');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: pk
        })
    });
}

const db = admin.firestore();

async function debugFirestore() {
    console.log("--- DEBUG FIRESTORE CONTENT ---");

    try {
        console.log("\n[ARTICLES]");
        const artSnap = await db.collection('articles').get();
        console.log(`Found ${artSnap.size} articles`);
        artSnap.forEach(doc => {
            const data = doc.data();
            console.log(`- ID: ${doc.id}`);
            console.log(`  Title: ${data.title}`);
            console.log(`  Profiles: ${JSON.stringify(data.assignedProfiles)}`);
            console.log(`  Phases: ${JSON.stringify(data.assignedPhases)}`);
        });

        console.log("\n[QUOTES]");
        const quoteSnap = await db.collection('quotes').get();
        console.log(`Found ${quoteSnap.size} quotes`);
        quoteSnap.forEach(doc => {
            const data = doc.data();
            console.log(`- ID: ${doc.id}`);
            console.log(`  Text: ${data.text?.substring(0, 30)}...`);
            console.log(`  Phase: ${data.assignedPhase}`);
            console.log(`  Profile: ${data.assignedProfile}`);
        });

    } catch (e: any) {
        console.error('Debug Error:', e.message);
    }
    console.log("\n--- END ---");
}

debugFirestore();
