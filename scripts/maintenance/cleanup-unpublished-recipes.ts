
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import axios from 'axios';
import admin from 'firebase-admin';

// ============================================================
// Firebase Admin Init
// ============================================================

if (!admin.apps.length) {
    const serviceAccountPath = path.join(__dirname, '../../../oh-club-firebase-adminsdk-fbsvc-1b7912aba5.json');
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
    });
    console.log('[FIREBASE] Admin SDK initialized using JSON file.');
}

const db = admin.firestore();

// ============================================================
// Strapi API Setup
// ============================================================

const STRAPI_URL = process.env.EXPO_PUBLIC_STRAPI_URL || 'https://useful-sparkle-79935e08b6.strapiapp.com';
const STRAPI_API_TOKEN = process.env.EXPO_PUBLIC_STRAPI_TOKEN;

const api = axios.create({
    baseURL: `${STRAPI_URL}/api`,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
});

async function fetchAllPublishedRecipeIds(): Promise<Set<string>> {
    let allIds = new Set<string>();
    let page = 1;
    const pageSize = 100;

    console.log('📡 Fetching published recipe IDs from Strapi...');

    while (true) {
        const { data } = await api.get('/recipes', {
            params: {
                'pagination[page]': page,
                'pagination[pageSize]': pageSize,
                'fields[0]': 'documentId',
                // publicationState is 'live' by default (published only)
            }
        });

        const items = data.data || [];
        items.forEach((item: any) => {
            if (item.documentId) allIds.add(item.documentId);
        });

        if (data.meta.pagination.page >= data.meta.pagination.pageCount) break;
        page++;
    }

    return allIds;
}

async function main() {
    if (!STRAPI_API_TOKEN) {
        console.error('❌ STRAPI_API_TOKEN is missing');
        process.exit(1);
    }

    const DRY_RUN = process.argv.includes('--dry-run');
    console.log('='.repeat(60));
    console.log('[CLEANUP] Sync Firestore recipes with Strapi publication status');
    console.log(DRY_RUN ? '⚠️  DRY RUN — no deletions' : '🔥 LIVE MODE — will DELETE unpublished recipes');
    console.log('='.repeat(60) + '\n');

    try {
        // 1. Get all published IDs from Strapi
        const publishedIds = await fetchAllPublishedRecipeIds();
        console.log(`📦 Strapi has ${publishedIds.size} published recipes.\n`);

        // 2. Get all documents from Firestore recipes
        console.log('🔥 Fetching all recipes from Firestore...');
        const snapshot = await db.collection('recipes').get();
        console.log(`🔥 Firestore has ${snapshot.size} recipes.\n`);

        let deletedCount = 0;
        let keptCount = 0;

        for (const doc of snapshot.docs) {
            const docId = doc.id;
            const data = doc.data();
            const name = data.name || 'Unnamed';

            if (!publishedIds.has(docId)) {
                console.log(`  ❌ REMOVING: "${name}" (${docId}) — not found or draft in Strapi`);
                if (!DRY_RUN) {
                    await db.collection('recipes').doc(docId).delete();
                }
                deletedCount++;
            } else {
                keptCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Cleanup Summary:');
        console.log(`  ✅ Kept:    ${keptCount}`);
        console.log(`  🗑️  Deleted: ${deletedCount}`);
        console.log(`  📦 Total:   ${snapshot.size}`);
        console.log('='.repeat(60));

    } catch (error: any) {
        console.error('[ERROR]', error.response?.data || error.message);
        process.exit(1);
    }
}

main();
