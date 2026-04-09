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

async function test() {
    try {
        console.log('Fetching...');
        const db = admin.firestore();
        const snap = await db.collection('ingredients').limit(1).get();
        console.log('Success, docs found:', snap.size);
    } catch (e: any) {
        console.error('Error:', e.message);
    }
}
test();
