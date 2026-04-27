/**
 * sync-habits-to-firestore.ts
 * 
 * Reads ALL published habits from Strapi REST API (with populated profiles),
 * then writes/merges them into Firebase Firestore's `habits` collection.
 * 
 * The data shape matches what the CMS lifecycle middleware produces:
 * - profiles → assignedProfiles (array of profile slugs)
 * - phases → assignedPhases (array of phase names)
 * - Removes internal Strapi fields (id, documentId, createdBy, etc.)
 * - Adds source: 'strapi' and updatedAt timestamp
 * 
 * Usage:
 *   npx tsx cms/scripts/sync-habits-to-firestore.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import axios from 'axios';
import admin from 'firebase-admin';

// ============================================================
// Firebase Admin Init
// ============================================================

if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined;

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        }),
    });
    console.log('[FIREBASE] Admin SDK initialized.');
}

const db = admin.firestore();

// ============================================================
// Strapi API Setup
// ============================================================

const STRAPI_URL = process.env.STRAPI_URL || 'https://useful-sparkle-79935e08b6.strapiapp.com';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

const api = axios.create({
    baseURL: `${STRAPI_URL}/api`,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
});

// ============================================================
// Fetch All Habits from Strapi (with populated profiles)
// ============================================================

interface StrapiHabit {
    id: number;
    documentId: string;
    name: string;
    description: string;
    content: string;
    category: string;
    type: string;
    unit: string;
    dailyGoal: number | null;
    priority: number;
    phases: string | string[] | null;
    icon: string | null;
    videoUrl: string | null;
    profiles: { id: number; documentId: string; name: string; slug: string }[];
    image: any;
    media?: { url: string; mime: string; name?: string }[];
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
}

async function fetchAllHabitsFromStrapi(): Promise<StrapiHabit[]> {
    let all: StrapiHabit[] = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
        const { data } = await api.get('/habits', {
            params: {
                'pagination[page]': page,
                'pagination[pageSize]': pageSize,
                'populate': '*',
            }
        });

        all = all.concat(data.data);

        if (data.meta.pagination.page >= data.meta.pagination.pageCount) break;
        page++;
    }

    return all;
}

// ============================================================
// Transform Strapi Habit → Firestore Document
// ============================================================

function transformHabitForFirestore(habit: StrapiHabit): Record<string, any> {
    // Map profiles to slugs (same as CMS middleware's handleRelations)
    const assignedProfiles = Array.isArray(habit.profiles)
        ? habit.profiles.map(p => p.slug || p.name || p.documentId)
        : [];

    // Phases can be a single string or array
    let assignedPhases: string[] = [];
    if (Array.isArray(habit.phases)) {
        assignedPhases = habit.phases;
    } else if (typeof habit.phases === 'string' && habit.phases.length > 0) {
        assignedPhases = [habit.phases];
    }

    // Build the Firestore document
    const doc: Record<string, any> = {
        name: habit.name || '',
        description: habit.description || '',
        content: habit.content || '',
        category: habit.category || 'zywienie',
        type: habit.type || 'program',
        unit: habit.unit || 'tak-nie',
        dailyGoal: habit.dailyGoal ?? 1,
        priority: habit.priority ?? 0,
        assignedProfiles,
        assignedPhases,
        updatedAt: new Date().toISOString(),
        source: 'strapi',
    };

    // Add optional fields only if they exist
    if (habit.icon) doc.icon = habit.icon;
    if (habit.videoUrl) doc.videoUrl = habit.videoUrl;

    // Handle image — extract URL if present
    if (habit.image && typeof habit.image === 'object') {
        const img = habit.image;
        if (img.url) doc.image = img.url;
        if (img.formats?.thumbnail?.url) doc.thumbnailUrl = img.formats.thumbnail.url;
    } else if (typeof habit.image === 'string' && habit.image) {
        doc.image = habit.image;
    }

    // Handle media files (videos, additional images)
    if (Array.isArray(habit.media) && habit.media.length > 0) {
        const base = (process.env.STRAPI_URL || 'https://useful-sparkle-79935e08b6.strapiapp.com').replace(/\/$/, '');
        doc.media = habit.media.map(m => ({
            url: m.url?.startsWith('http') ? m.url : `${base}${m.url}`,
            mime: m.mime || '',
        }));
    }

    return doc;
}

// ============================================================
// Main
// ============================================================

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    if (!STRAPI_API_TOKEN) {
        console.error('❌ STRAPI_API_TOKEN is missing in cms/.env');
        process.exit(1);
    }

    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        console.error('❌ Firebase credentials are missing in cms/.env');
        process.exit(1);
    }

    console.log('🚀 Starting Strapi → Firestore sync for habits...');
    console.log(`📡 Strapi: ${STRAPI_URL}`);
    console.log(`🔥 Firestore project: ${process.env.FIREBASE_PROJECT_ID}`);

    // 1. Fetch all habits from Strapi
    const habits = await fetchAllHabitsFromStrapi();
    console.log(`\n📦 Fetched ${habits.length} published habits from Strapi.`);

    // 2. Write each habit to Firestore
    let synced = 0;
    let failed = 0;

    // Use batched writes for efficiency (max 500 per batch)
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let batchCount = 0;

    for (const habit of habits) {
        const docId = habit.documentId;
        if (!docId) {
            console.warn(`⚠️ Skipping habit "${habit.name}" — no documentId`);
            failed++;
            continue;
        }

        const firestoreDoc = transformHabitForFirestore(habit);
        const ref = db.collection('habits').doc(docId);
        batch.set(ref, firestoreDoc, { merge: true });
        batchCount++;
        synced++;

        const profileNames = firestoreDoc.assignedProfiles.join(', ') || 'none';
        console.log(`  ✅ Queued: "${habit.name}" → habits/${docId} [${profileNames}]`);

        // Commit batch when it reaches BATCH_SIZE
        if (batchCount >= BATCH_SIZE) {
            console.log(`\n💾 Committing batch of ${batchCount} documents...`);
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
            await sleep(500);
        }
    }

    // Commit remaining documents
    if (batchCount > 0) {
        console.log(`\n💾 Committing final batch of ${batchCount} documents...`);
        await batch.commit();
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Firestore Sync Summary:');
    console.log(`  ✅ Synced:  ${synced}`);
    console.log(`  ⚠️  Failed: ${failed}`);
    console.log(`  📦 Total:  ${habits.length}`);
    console.log('='.repeat(60));
    console.log('🎉 Done! All habits are now in Firestore.');
}

main().catch(console.error);
