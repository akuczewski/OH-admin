/**
 * seed-macro-targets.ts
 *
 * Wgrywa cele makroskładników per program (komponent `profile.macroTargets`) wg tabeli
 * Klaudii z SPEC-dieta-silnik.md, sekcja 3c.
 *
 * `profile` ma draft&publish — żeby zmiana dotarła do apki (Firestore sync tylko dla
 * opublikowanych), zapis idzie z `status=published`. OCHRONA: jeśli program ma szkic
 * nowszy niż wersja opublikowana (niedokończone zmiany w CMS), skrypt go POMIJA, żeby
 * nie wypchnąć cudzych zmian na produkcję.
 *
 * Domyślnie DRY-RUN. Zapis: --apply.
 *   cd apps/cms && npx tsx scripts/maintenance/seed-macro-targets.ts [--apply]
 */
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';

dotenv.config({ path: path.join(__dirname, '../.env') });

const STRAPI_URL = process.env.STRAPI_URL || 'https://useful-sparkle-79935e08b6.strapiapp.com';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
const APPLY = process.argv.includes('--apply');

// SPEC 3c (potwierdzone przez Klaudię)
const TARGETS: Record<string, { proteinMin: number; proteinMax: number; carbsMin: number; carbsMax: number; fatMin: number; fatMax: number }> = {
    'opanuj-cukier': { proteinMin: 15, proteinMax: 35, carbsMin: 20, carbsMax: 45, fatMin: 20, fatMax: 50 },
    'opanuj-stres': { proteinMin: 10, proteinMax: 30, carbsMin: 40, carbsMax: 60, fatMin: 20, fatMax: 35 },
    'opanuj-skore': { proteinMin: 15, proteinMax: 35, carbsMin: 30, carbsMax: 60, fatMin: 20, fatMax: 40 },
    'glow-up': { proteinMin: 15, proteinMax: 35, carbsMin: 20, carbsMax: 60, fatMin: 20, fatMax: 50 },
};

// Granice uniwersalne (SPEC 3b) — sanity check tabeli przed zapisem.
const UNIVERSAL = { protein: [10, 35], carbs: [20, 60], fat: [20, 50] } as const;

const api = axios.create({
    baseURL: `${STRAPI_URL}/api`,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${STRAPI_API_TOKEN}` },
});

async function getProfiles(status: 'draft' | 'published') {
    const { data } = await api.get('/profiles', { params: { status, 'pagination[pageSize]': 50, populate: 'macroTargets' } });
    return data.data as any[];
}

async function main() {
    if (!STRAPI_API_TOKEN) {
        console.error('❌ Brak STRAPI_API_TOKEN w apps/cms/scripts/.env');
        process.exit(1);
    }
    for (const [slug, t] of Object.entries(TARGETS)) {
        const ok = t.proteinMin >= UNIVERSAL.protein[0] && t.proteinMax <= UNIVERSAL.protein[1]
            && t.carbsMin >= UNIVERSAL.carbs[0] && t.carbsMax <= UNIVERSAL.carbs[1]
            && t.fatMin >= UNIVERSAL.fat[0] && t.fatMax <= UNIVERSAL.fat[1];
        if (!ok) throw new Error(`Cel ${slug} wychodzi poza granice uniwersalne 3b`);
    }
    console.log(`${APPLY ? '✍️  ZAPIS' : '🔍 DRY-RUN (bez zapisu)'} — ${STRAPI_URL}\n`);

    let published: any[];
    let drafts: any[];
    try {
        [published, drafts] = await Promise.all([getProfiles('published'), getProfiles('draft')]);
    } catch (e: any) {
        // Przed wdrożeniem schematu populate=macroTargets daje 400 — pobierz bez niego.
        if (e.response?.status !== 400 || APPLY) throw e;
        console.log('ℹ️  Schemat z macroTargets nie jest jeszcze wdrożony — raport bez bieżących wartości.\n');
        const raw = async (status: string) => (await api.get('/profiles', { params: { status, 'pagination[pageSize]': 50 } })).data.data;
        [published, drafts] = await Promise.all([raw('published'), raw('draft')]);
    }

    for (const [slug, target] of Object.entries(TARGETS)) {
        const pub = published.find((p) => p.slug === slug);
        const dr = drafts.find((p) => p.slug === slug);
        if (!pub) {
            console.log(`⚠️  ${slug}: brak opublikowanego programu — pomijam`);
            continue;
        }
        const dirtyDraft = dr && pub && new Date(dr.updatedAt).getTime() > new Date(pub.updatedAt).getTime() + 1000;
        console.log(`• ${slug} (${pub.documentId}) teraz: ${JSON.stringify(pub.macroTargets ?? null)}`);
        console.log(`    → cel: B ${target.proteinMin}-${target.proteinMax}% | W ${target.carbsMin}-${target.carbsMax}% | T ${target.fatMin}-${target.fatMax}%`);
        if (dirtyDraft) {
            console.log(`    ⛔ szkic nowszy niż wersja opublikowana — POMIJAM (nie publikuję cudzych zmian)`);
            continue;
        }
        if (APPLY) {
            await api.put(`/profiles/${pub.documentId}`, { data: { macroTargets: target } }, { params: { status: 'published' } });
            console.log('    ✅ zapisane i opublikowane');
        }
    }
    if (!APPLY) console.log('\nℹ️  Dry-run zakończony. Zapis: dodaj --apply.');
}

main().catch((err) => {
    console.error('Błąd krytyczny:', err.response?.data || err.message);
    process.exit(1);
});
