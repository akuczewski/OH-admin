import 'dotenv/config';
import type { Core } from '@strapi/strapi';
import admin from 'firebase-admin';

/**
 * deep-wipe.ts
 * 
 * CRITICAL: Deletes ALL Recipes and Ingredients from both Strapi and Firebase.
 * Used for "Fresh Start" migrations.
 */

if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (privateKey) {
        privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
    }

    if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
            credential: admin.credential.cert({
                project_id: projectId,
                client_email: clientEmail,
                private_key: privateKey,
            } as any),
        });
        console.log('[WIPE] Firebase Admin Initialized.');
    }
}
const db = admin.firestore();

const STRAPI_URL = process.env.STRAPI_URL;
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

async function runWipe() {
    console.log(`[WIPE] !!! STARTING DEEP WIPE ON ${STRAPI_URL} !!!`);

    if (!STRAPI_URL || !STRAPI_TOKEN) {
        console.error('[WIPE] Missing Strapi credentials in .env');
        return;
    }

    const headers = {
        'Authorization': `Bearer ${STRAPI_TOKEN}`,
        'Content-Type': 'application/json'
    };

    // 1. Wipe Strapi Recipes
    console.log('[WIPE] Clearing Strapi Recipes...');
    while (true) {
        const res = await fetch(`${STRAPI_URL}/api/recipes?pagination[pageSize]=100`, { headers });
        const json: any = await res.json();
        if (!json.data || json.data.length === 0) break;
        
        console.log(`[WIPE] Deleting batch of ${json.data.length} recipes...`);
        for (const item of json.data) {
            await fetch(`${STRAPI_URL}/api/recipes/${item.documentId}`, { method: 'DELETE', headers });
        }
    }

    // 2. Wipe Strapi Ingredients
    console.log('[WIPE] Clearing Strapi Ingredients...');
    while (true) {
        const res = await fetch(`${STRAPI_URL}/api/ingredients?pagination[pageSize]=100`, { headers });
        const json: any = await res.json();
        if (!json.data || json.data.length === 0) break;
        
        console.log(`[WIPE] Deleting batch of ${json.data.length} ingredients...`);
        for (const item of json.data) {
            await fetch(`${STRAPI_URL}/api/ingredients/${item.documentId}`, { method: 'DELETE', headers });
        }
    }

    if (db) {
        // 3. Wipe Firebase Recipes
        console.log('[WIPE] Clearing Firebase Recipes...');
        const recipeDocs = await db.collection('recipes').get();
        const recipeBatch = db.batch();
        recipeDocs.forEach(doc => recipeBatch.delete(doc.ref));
        await recipeBatch.commit();

        // 4. Wipe Firebase Ingredients
        console.log('[WIPE] Clearing Firebase Ingredients...');
        const ingsColl = await db.collection('ingredients').get();
        const batch = db.batch();
        ingsColl.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }

    console.log('[WIPE] SUCCESS: Remote database and Firebase are now clean.');
}

async function main() {
    try {
        await runWipe();
    } catch (err) {
        console.error('[WIPE] Fatal Error:', err);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}

main().catch(err => {
    console.error('[WIPE] Fatal Error:', err);
    process.exit(1);
});
