/**
 * seed-experts.ts
 *
 * Jednorazowy (idempotentny) seed 2 ekspertów do płatnych konsultacji:
 * dietetyk + kosmetolog. Dopasowanie po `name` — bezpiecznie odpalić ponownie.
 * Nowych ekspertów / nowe specjalizacje dodaje się później z poziomu Strapi
 * admin (bez zmian w kodzie).
 *
 * Wymaga w apps/cms/scripts/.env: STRAPI_URL + STRAPI_API_TOKEN (token z prawem
 * zapisu, ten sam co seed-promo-codes.ts).
 *
 * Użycie:
 *   cd apps/cms && npx tsx scripts/seed-experts.ts
 */
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

const STRAPI_URL = process.env.STRAPI_URL || 'https://useful-sparkle-79935e08b6.strapiapp.com';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

const api = axios.create({
    baseURL: `${STRAPI_URL}/api`,
    timeout: 30000,
    headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
});

interface ExpertSeed {
    name: string;
    title: string;
    specialization: string;
    description: string;
    avatarEmoji: string;
    // PLACEHOLDER — podmień na realne publiczne linki Calendly po założeniu kont.
    calendlyUrl: string;
    priceGrosze: number;
    expertPayoutGrosze: number;
    vatTreatment: 'exempt' | 'standard23';
    active: boolean;
    sortOrder: number;
}

const EXPERTS: ExpertSeed[] = [
    {
        name: 'Konsultacja z dietetykiem',
        title: 'Dietetyk kliniczny',
        specialization: 'dietetyk',
        description:
            'Indywidualna konsultacja dotycząca odżywiania, poziomu energii, apetytu i diety dopasowanej do cyklu. Online, ok. 50 minut.',
        avatarEmoji: '🥗',
        calendlyUrl: 'https://calendly.com/oh-club-dietetyk/konsultacja',
        priceGrosze: 24900,
        expertPayoutGrosze: 12450,
        vatTreatment: 'exempt',
        active: true,
        sortOrder: 1,
    },
    {
        name: 'Konsultacja z kosmetologiem',
        title: 'Kosmetolog',
        specialization: 'kosmetolog',
        description:
            'Indywidualna konsultacja dotycząca pielęgnacji i problemów skórnych w kontekście cyklu i codziennych nawyków. Online, ok. 50 minut.',
        avatarEmoji: '✨',
        calendlyUrl: 'https://calendly.com/oh-club-kosmetolog/konsultacja',
        priceGrosze: 24900,
        expertPayoutGrosze: 12450,
        vatTreatment: 'exempt',
        active: true,
        sortOrder: 2,
    },
];

async function findByName(name: string): Promise<number | null> {
    const res = await api.get('/experts', {
        params: { 'filters[name][$eq]': name, 'pagination[pageSize]': 1 },
    });
    return res.data?.data?.[0]?.documentId ?? null;
}

async function main() {
    if (!STRAPI_API_TOKEN) {
        console.error('❌ Brak STRAPI_API_TOKEN w apps/cms/scripts/.env');
        process.exit(1);
    }

    for (const expert of EXPERTS) {
        const existing = await findByName(expert.name);
        if (existing) {
            console.log(`⏭  "${expert.name}" już istnieje (${existing}) — pomijam`);
            continue;
        }
        await api.post('/experts', { data: expert });
        console.log(`✅ Utworzono "${expert.name}" (${expert.specialization}, ${expert.priceGrosze / 100} zł)`);
    }

    console.log('\n⚠️  Podmień placeholder calendlyUrl na realne linki Calendly w Strapi admin.');
}

main().catch((err) => {
    console.error('❌ Seed nie powiódł się:', err.response?.data ?? err.message);
    process.exit(1);
});
