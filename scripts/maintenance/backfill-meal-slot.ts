/**
 * backfill-meal-slot.ts
 *
 * Jednorazowy skrypt migracji: wypełnia pole `mealSlot` (enumeration)
 * na podstawie pierwszej wartości z `mealSlots` (JSON array) dla wszystkich
 * istniejących przepisów w Strapi.
 *
 * Uruchom RAZ po wdrożeniu nowego pola `mealSlot` w schemacie:
 *   npx tsx cms/scripts/maintenance/backfill-meal-slot.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import axios from 'axios';

const STRAPI_URL = process.env.STRAPI_URL || 'https://useful-sparkle-79935e08b6.strapiapp.com';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

const VALID_SLOTS = ['sniadanie', 'przekaska', 'obiad', 'kolacja'];

// Mapowanie starych wartości z mealSlots JSON na nowy uproszczony slot
const SLOT_MAP: Record<string, string> = {
    'sniadanie': 'sniadanie',
    'sniadanie-2': 'sniadanie',
    'przekaska': 'przekaska',
    'przekaska-1': 'przekaska',
    'przekaska-2': 'przekaska',
    'obiad': 'obiad',
    'kolacja': 'kolacja',
};

const api = axios.create({
    baseURL: `${STRAPI_URL}/api`,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
});

async function fetchAllRecipes(): Promise<any[]> {
    let all: any[] = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
        const { data } = await api.get('/recipes', {
            params: {
                'pagination[page]': page,
                'pagination[pageSize]': pageSize,
                'fields[0]': 'documentId',
                'fields[1]': 'name',
                'fields[2]': 'mealSlots',
                'fields[3]': 'mealSlot',
            }
        });
        all = all.concat(data.data);
        if (data.meta.pagination.page >= data.meta.pagination.pageCount) break;
        page++;
    }

    return all;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    if (!STRAPI_API_TOKEN) {
        console.error('❌ STRAPI_API_TOKEN is missing in cms/.env');
        process.exit(1);
    }

    console.log('🚀 Backfill mealSlot enumeration from mealSlots JSON...');
    console.log(`📡 Strapi: ${STRAPI_URL}\n`);

    const recipes = await fetchAllRecipes();
    console.log(`📦 Fetched ${recipes.length} recipes.\n`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const recipe of recipes) {
        const docId = recipe.documentId;
        const name = recipe.name || docId;
        const existingSlot: string | null = recipe.mealSlot || null;
        const rawSlots: any = recipe.mealSlots;

        // Parsujemy mealSlots — może być string JSON lub już tablica
        let slots: string[] = [];
        if (Array.isArray(rawSlots)) {
            slots = rawSlots;
        } else if (typeof rawSlots === 'string') {
            try { slots = JSON.parse(rawSlots); } catch { slots = [rawSlots]; }
        }

        const primarySlot = slots.map(s => SLOT_MAP[s]).find(s => !!s) || null;

        if (existingSlot) {
            console.log(`  ⏭️  SKIP: "${name}" — mealSlot already set to "${existingSlot}"`);
            skipped++;
            continue;
        }

        if (!primarySlot) {
            console.log(`  ⚠️  SKIP: "${name}" — no valid mealSlots to migrate (raw: ${JSON.stringify(rawSlots)})`);
            skipped++;
            continue;
        }

        try {
            await api.put(`/recipes/${docId}`, {
                data: { mealSlot: primarySlot }
            });
            console.log(`  ✅ "${name}" → mealSlot = "${primarySlot}"`);
            updated++;
        } catch (err: any) {
            console.error(`  ❌ "${name}": ${err.response?.data?.error?.message || err.message}`);
            failed++;
        }

        await sleep(150);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Summary:');
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Failed:  ${failed}`);
    console.log('='.repeat(60));
    console.log('🎉 Done! Run once — do not run again.');
}

main().catch(console.error);
