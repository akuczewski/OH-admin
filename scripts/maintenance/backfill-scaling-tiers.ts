/**
 * backfill-scaling-tiers.ts
 *
 * Uzupełnia na składnikach (`skladnik`) pola `scalingTier` i `maxAdjustPercent` wg
 * wytycznych Klaudii (SPEC-dieta-silnik.md, 3a.1 i 8b). Najpierw reguły po NAZWIE
 * (sól, ostre, kakao, zioła, sery słone, dodatki technologiczne), potem domyślne
 * wartości per KATEGORIA. Składnik bez pasującej reguły zostaje pusty — silnik
 * traktuje brak kategorii jak `locked` (nie rusza), a raport listuje go do przeglądu.
 *
 * `skladnik` nie ma draft&publish → zapis od razu synchronizuje się do Firestore
 * (middleware documents.use w src/index.ts).
 *
 * Domyślnie DRY-RUN (tylko raport). Zapis: --apply. Nadpisanie już ustawionych
 * wartości (np. ręcznie przez Klaudię): --force (bez niego ustawione pomijamy).
 *
 *   cd apps/cms && npx tsx scripts/maintenance/backfill-scaling-tiers.ts            # raport
 *   cd apps/cms && npx tsx scripts/maintenance/backfill-scaling-tiers.ts --apply    # zapis
 */
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';

dotenv.config({ path: path.join(__dirname, '../.env') });

const STRAPI_URL = process.env.STRAPI_URL || 'https://useful-sparkle-79935e08b6.strapiapp.com';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

type Tier = 'locked' | 'limited' | 'flexible' | 'functional';
type Rule = { tier: Tier; pct: number; why: string };

// ---- Reguły po nazwie (pierwsza pasująca wygrywa; kolejność ma znaczenie) ----
const NAME_RULES: Array<[RegExp, Rule]> = [
    // Zablokowane: sól i ostre przyprawy (Klaudia: locked)
    [/\bsól\b|^sól/i, { tier: 'locked', pct: 0, why: 'sól' }],
    [/cayenne|chili|ostra przyprawa|papryka ostra|sriracha/i, { tier: 'locked', pct: 0, why: 'ostre' }],
    // Technologiczne bez automatycznej zmiany
    [/soda oczyszczona|żelatyn|agar|pektyn|ksantan|guar|galaretka/i, { tier: 'functional', pct: 0, why: 'technologiczny, 0%' }],
    [/budyń/i, { tier: 'functional', pct: 0, why: 'zagęstnik, 0%' }],
    [/^ocet|sok z cytryny|sok z limonki/i, { tier: 'functional', pct: 0, why: 'kwas w roli technologicznej, 0%' }],
    // Technologiczne ±5%
    [/proszek do pieczenia/i, { tier: 'functional', pct: 5, why: 'proszek do pieczenia ±5%' }],
    [/drożdże świeże|drożdże suszone|^drożdże/i, { tier: 'functional', pct: 5, why: 'drożdże ±5%' }],
    [/skrobia|mąka ziemniaczana/i, { tier: 'functional', pct: 5, why: 'skrobia ±5%' }],
    // Produkty jedzeniowe PRZED regułami smakowymi (np. "Baton … wanilia", "Skyr waniliowy"
    // to białko, nie aromat; "Fenkuł (koper włoski)", "Pietruszka korzeń" to warzywa)
    [/chleb|bułka|pinsa|gnocchi|makaron|papier ryżowy|biszkopt|ryż z kalafiora|pomidory suszone|fenkuł|koper włoski|pietruszka korzeń/i, { tier: 'flexible', pct: 20, why: 'węglowodany/warzywa ±20%' }],
    [/izolat|baton|tuńczyk|makrela|kiełbasa|skyr/i, { tier: 'flexible', pct: 15, why: 'białko ±15%' }],
    [/napój|bulion|rosół|wywar|daktyle/i, { tier: 'flexible', pct: 15, why: 'baza płynna/owoc ±15%' }],
    [/\bmak\b|^mak|nasiona kolendry|płatki drożdżowe/i, { tier: 'limited', pct: 10, why: 'dodatek smakowy ±10%' }],
    // Ograniczone (przyprawy, nigdy źródło korekty)
    [/pieprz czarny/i, { tier: 'limited', pct: 5, why: 'pieprz czarny ±5%' }],
    [/kakao|matcha|kawa/i, { tier: 'limited', pct: 10, why: 'kakao/matcha/kawa ±10%' }],
    [/kurkuma|curry|papryka wędzona|słodka papryka|papryka słodka/i, { tier: 'limited', pct: 15, why: 'kurkuma/curry/papryka ±15%' }],
    [/cynamon|wanili|aromat/i, { tier: 'limited', pct: 20, why: 'cynamon/wanilia/aromat ±20%' }],
    [/oregano|bazylia|tymianek|rozmaryn|majeranek|koper|kolendra|mięta|zioła|pietruszka|natka|szczypiorek|liść laurowy|czosnek niedźwiedzi|skórka z (cytryny|pomarańczy)/i,
        { tier: 'limited', pct: 20, why: 'zioła ±20%' }],
    [/cukier|dżem|pyłek pszczeli/i, { tier: 'limited', pct: 10, why: 'słodzące, nie źródło korekty' }],
    // Sery słone, sos sojowy, kapary, oliwki — ±10% (Klaudia 2026-10-27, sód)
    [/feta|parmezan|grana padano|halloumi|oscypek|ricotta salata|gorgonzola|cheddar|sos sojowy|kapary|oliwki/i,
        { tier: 'flexible', pct: 10, why: 'słone ±10%' }],
];

// ---- Domyślne per kategoria CMS (SPEC 8b) ----
const CATEGORY_DEFAULTS: Record<string, Rule> = {
    'warzywa': { tier: 'flexible', pct: 20, why: 'kat. warzywa' },
    'nabiał': { tier: 'flexible', pct: 15, why: 'kat. nabiał (białko)' },
    'nabiał bez laktozy': { tier: 'flexible', pct: 15, why: 'kat. nabiał' },
    'przyprawy': { tier: 'limited', pct: 15, why: 'kat. przyprawy (domyślnie)' },
    'owoce': { tier: 'flexible', pct: 15, why: 'kat. owoce' },
    'owoce suszone': { tier: 'flexible', pct: 15, why: 'kat. owoce' },
    'ziarna': { tier: 'flexible', pct: 20, why: 'kat. ziarna' },
    'ziarna bezglutenowe': { tier: 'flexible', pct: 20, why: 'kat. ziarna' },
    'zboża': { tier: 'flexible', pct: 20, why: 'kat. zboża' },
    'produkty zbożowe': { tier: 'flexible', pct: 20, why: 'kat. zboża' },
    'mięso': { tier: 'flexible', pct: 15, why: 'kat. mięso' },
    'ryby': { tier: 'flexible', pct: 15, why: 'kat. ryby' },
    'owoce morza': { tier: 'flexible', pct: 15, why: 'kat. owoce morza' },
    'jaja': { tier: 'flexible', pct: 15, why: 'kat. jaja (sztuki)' },
    'produkty roślinne': { tier: 'flexible', pct: 15, why: 'kat. produkty roślinne' },
    'odżywki białkowe': { tier: 'flexible', pct: 15, why: 'kat. odżywki (białko)' },
    'pieczywo': { tier: 'flexible', pct: 20, why: 'kat. pieczywo' },
    'mąki': { tier: 'flexible', pct: 20, why: 'kat. mąki' },
    'strączki': { tier: 'flexible', pct: 20, why: 'kat. strączki' },
    'nasiona i orzechy': { tier: 'flexible', pct: 10, why: 'kat. orzechy/nasiona' },
    'nasiona': { tier: 'flexible', pct: 10, why: 'kat. nasiona' },
    'tłuszcze': { tier: 'flexible', pct: 15, why: 'kat. tłuszcze' },
    'sosy i dressingi': { tier: 'flexible', pct: 10, why: 'kat. sosy' },
    'pasty / smarowidła': { tier: 'flexible', pct: 10, why: 'kat. pasty' },
    'słodycze': { tier: 'limited', pct: 10, why: 'kat. słodycze' },
    'słodziki': { tier: 'limited', pct: 10, why: 'kat. słodziki' },
    'mrożonki': { tier: 'flexible', pct: 20, why: 'kat. mrożonki (warzywa/owoce)' },
    'przetwory': { tier: 'flexible', pct: 20, why: 'kat. przetwory (warzywa/strączki)' },
    'napoje': { tier: 'flexible', pct: 15, why: 'kat. napoje' },
    'dodatki do pieczenia': { tier: 'functional', pct: 0, why: 'kat. dodatki do pieczenia' },
};

export function classify(name: string, category: string): Rule | null {
    for (const [re, rule] of NAME_RULES) if (re.test(name)) return rule;
    return CATEGORY_DEFAULTS[(category || '').trim().toLowerCase()] ?? null;
}

const api = axios.create({
    baseURL: `${STRAPI_URL}/api`,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${STRAPI_API_TOKEN}` },
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchAll(): Promise<any[]> {
    let all: any[] = [];
    let page = 1;
    while (true) {
        const { data } = await api.get('/skladniks', {
            params: { 'pagination[page]': page, 'pagination[pageSize]': 100, 'sort': 'name:asc' },
        });
        all = all.concat(data.data);
        if (data.meta.pagination.page >= data.meta.pagination.pageCount) break;
        page++;
    }
    return all;
}

async function main() {
    if (!STRAPI_API_TOKEN) {
        console.error('❌ Brak STRAPI_API_TOKEN w apps/cms/scripts/.env');
        process.exit(1);
    }
    console.log(`${APPLY ? '✍️  ZAPIS' : '🔍 DRY-RUN (bez zapisu)'} — ${STRAPI_URL}${FORCE ? ' (--force)' : ''}\n`);

    const items = await fetchAll();
    const plan: Array<{ id: string; name: string; category: string; rule: Rule | null; current: string | null }> = [];
    for (const it of items) {
        if (!('scalingTier' in it) && APPLY) {
            console.error('❌ Pole scalingTier nie istnieje w API — najpierw wdroż schemat CMS (OH-admin).');
            process.exit(1);
        }
        plan.push({
            id: it.documentId,
            name: it.name,
            category: it.category,
            rule: classify(it.name, it.category),
            current: it.scalingTier ?? null,
        });
    }

    const byTier: Record<string, number> = {};
    for (const p of plan) {
        const k = p.rule ? `${p.rule.tier} ${p.rule.pct}%` : 'BRAK (do przeglądu)';
        byTier[k] = (byTier[k] || 0) + 1;
    }
    console.log(`📦 Składników: ${items.length}`);
    console.log('📊 Rozkład:', byTier);

    const show = (title: string, rows: typeof plan) => {
        if (!rows.length) return;
        console.log(`\n${title} (${rows.length}):`);
        rows.forEach((r) => console.log(`   ${r.name} [${r.category}] → ${r.rule ? `${r.rule.tier} ${r.rule.pct}% (${r.rule.why})` : '—'}`));
    };
    show('🔒 locked', plan.filter((p) => p.rule?.tier === 'locked'));
    show('⚙️  functional', plan.filter((p) => p.rule?.tier === 'functional'));
    show('🌿 limited', plan.filter((p) => p.rule?.tier === 'limited'));
    show('🧂 flexible ±10% (słone/sosy/orzechy/pasty)', plan.filter((p) => p.rule?.tier === 'flexible' && p.rule.pct === 10));
    show('❓ BRAK reguły (zostaje puste = silnik nie rusza)', plan.filter((p) => !p.rule));

    if (!APPLY) {
        console.log('\nℹ️  Dry-run zakończony. Zapis: dodaj --apply.');
        return;
    }

    let written = 0, skipped = 0, failed = 0;
    for (const p of plan) {
        if (!p.rule) { skipped++; continue; }
        if (p.current && !FORCE) { skipped++; continue; }
        try {
            await api.put(`/skladniks/${p.id}`, { data: { scalingTier: p.rule.tier, maxAdjustPercent: p.rule.pct } });
            written++;
        } catch (e: any) {
            failed++;
            console.error(`   ❌ ${p.name}:`, e.response?.data?.error?.message || e.message);
        }
        await sleep(120);
    }
    console.log(`\n✅ Zapisane: ${written}, pominięte: ${skipped}, błędy: ${failed}`);
}

main().catch((err) => {
    console.error('Błąd krytyczny:', err.response?.data || err.message);
    process.exit(1);
});
