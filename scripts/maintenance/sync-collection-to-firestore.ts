/**
 * Generyczny resync kolekcji Strapi → Firestore (replika czytana przez apkę).
 *
 * Użycie:
 *   npx tsx scripts/maintenance/sync-collection-to-firestore.ts <kolekcja>
 *   np. npx tsx scripts/maintenance/sync-collection-to-firestore.ts skincare
 *
 * Obsługiwane kolekcje: skincare, training, articles, quotes, profiles, habits
 * (przepisy mają dedykowany sync-recipes-to-firestore.ts — wymagają mapowania
 * składników/profili; ten skrypt odwzorowuje zachowanie middleware'u dla
 * pozostałych typów: populate '*', zapis set(merge: true) po documentId).
 *
 * Bezpieczeństwo: Strapi tylko czytane (wpisy opublikowane); zapis to upsert —
 * niczego nie kasuje. Skrypt jest idempotentny.
 */
import dotenv from 'dotenv';
import path from 'path';
// Monorepo: token Strapi w apps/mobile/.env, klucz admin SDK w root repo
dotenv.config({ path: path.join(__dirname, '../../../../apps/mobile/.env') });

import axios from 'axios';
import admin from 'firebase-admin';

if (!admin.apps.length) {
    const serviceAccountPath = path.join(__dirname, '../../../../oh-club-firebase-adminsdk-fbsvc-1b7912aba5.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
    });
    console.log('[FIREBASE] Admin SDK initialized using JSON file.');
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const STRAPI_URL = process.env.EXPO_PUBLIC_STRAPI_URL || 'https://useful-sparkle-79935e08b6.strapiapp.com';
const STRAPI_API_TOKEN = process.env.EXPO_PUBLIC_STRAPI_TOKEN;

// kolekcja Firestore -> endpoint Strapi (zgodnie z collectionsToSync w src/index.ts)
const COLLECTIONS: Record<string, string> = {
    skincare: 'skin-cares',
    training: 'trainings',
    articles: 'articles',
    quotes: 'motivation-quotes',
    profiles: 'profiles',
    habits: 'habits',
    creators: 'creators',
    privacy_sections: 'privacy-sections',
    faq_items: 'faq-items',
    screen_texts: 'screen-texts',
};

/**
 * Normalizacja URL obrazu — odwzorowuje normalizeImageUrl z src/index.ts.
 * Twórcy w apce oczekują `image` jako gotowego stringa (mapCreatorDoc), a nie
 * obiektu media Strapi — middleware robi to przy publish, więc backfill też musi.
 */
function normalizeImageUrl(image: any): string {
    const url = image?.url || (typeof image === 'string' ? image : '');
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const strapiUrl = (STRAPI_URL || 'http://localhost:1337').replace(/\/$/, '');
    return `${strapiUrl}${url.startsWith('/') ? url : `/${url}`}`;
}

/** Per-kolekcja: transformacje doprowadzające dokument do kształtu czytanego przez apkę. */
function transformForCollection(col: string, item: any): any {
    if (col === 'creators') {
        return { ...item, image: normalizeImageUrl(item.image) };
    }
    return item;
}

const api = axios.create({
    baseURL: `${STRAPI_URL}/api`,
    timeout: 30000,
    headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
});

async function fetchAll(endpoint: string): Promise<any[]> {
    let all: any[] = [];
    let page = 1;
    while (true) {
        const { data } = await api.get(`/${endpoint}`, {
            params: {
                'pagination[page]': page,
                'pagination[pageSize]': 100,
                populate: '*', // jak middleware dla typów innych niż recipe
            },
        });
        all = all.concat(data.data);
        if (data.meta.pagination.page >= data.meta.pagination.pageCount) break;
        page++;
    }
    return all;
}

async function main() {
    const col = process.argv[2];
    if (!col || !COLLECTIONS[col]) {
        console.error(`Użycie: sync-collection-to-firestore.ts <${Object.keys(COLLECTIONS).join('|')}>`);
        process.exit(1);
    }
    if (!STRAPI_API_TOKEN) {
        console.error('❌ Brak EXPO_PUBLIC_STRAPI_TOKEN w env');
        process.exit(1);
    }

    console.log(`🚀 Resync ${col} (Strapi /${COLLECTIONS[col]} → Firestore '${col}')...`);
    const items = await fetchAll(COLLECTIONS[col]);
    console.log(`📦 Pobrano ${items.length} opublikowanych wpisów ze Strapi.`);

    let synced = 0;
    let batch = db.batch();
    for (const item of items) {
        if (!item.documentId) continue;
        batch.set(db.collection(col).doc(item.documentId), transformForCollection(col, { ...item }), { merge: true });
        synced++;
        if (synced % 400 === 0) { // limit batcha Firestore to 500 operacji
            await batch.commit();
            batch = db.batch();
        }
    }
    if (synced % 400 !== 0) await batch.commit();

    console.log(`🎉 Gotowe: ${synced} dokumentów zsynchronizowanych (set merge, bez kasowań).`);
}

main().catch((e) => { console.error('[ERROR]', e.response?.data || e.message); process.exit(1); });
