/**
 * seed-screen-content-to-strapi.ts
 *
 * Jednorazowy import treści ekranu Profil → Prywatność / Pomoc (dotychczas hardcoded
 * w aplikacji) do Strapi: kolekcje `privacy-section`, `faq-item`, `screen-text`.
 * Upsert po polu naturalnym (title / question / key), tworzy/aktualizuje i publikuje
 * (publish wyzwala lifecycle sync do Firestore — patrz src/index.ts collectionsToSync).
 *
 * Wymaga w apps/cms/scripts/.env: STRAPI_URL + STRAPI_API_TOKEN (token z prawem zapisu).
 * Content-types muszą już istnieć w docelowym Strapi (po deployu OH-admin → Strapi Cloud).
 *
 * Użycie:
 *   cd apps/cms && npx tsx scripts/maintenance/seed-screen-content-to-strapi.ts
 */
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

const STRAPI_URL = process.env.STRAPI_URL || 'https://useful-sparkle-79935e08b6.strapiapp.com';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

const api = axios.create({
    baseURL: `${STRAPI_URL}/api`,
    timeout: 60000,
    headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T> {
    let lastErr: any;
    for (let i = 1; i <= attempts; i++) {
        try {
            return await fn();
        } catch (err: any) {
            lastErr = err;
            const status = err.response?.status;
            const transient = !status || status >= 500 || err.code === 'ECONNABORTED';
            if (!transient || i === attempts) throw err;
            const backoff = 2000 * i;
            console.log(`  ↻ ${label}: próba ${i}/${attempts} (${status || err.code}), ponawiam za ${backoff}ms`);
            await sleep(backoff);
        }
    }
    throw lastErr;
}

const PRIVACY_SECTIONS = [
    { title: 'Jakie dane zbieramy', body: 'OH! Club zbiera wyłącznie dane, które sama podajesz: imię, adres e-mail, dane dotyczące cyklu miesiączkowego, wybrane nawyki oraz preferencje żywieniowe. Nie zbieramy danych lokalizacji, kontaktów ani żadnych innych danych z Twojego urządzenia bez Twojej wyraźnej zgody.', order: 0 },
    { title: 'Jak przechowujemy Twoje dane', body: 'Dane są przechowywane w bezpiecznej infrastrukturze Google Firebase, szyfrowane podczas transmisji (TLS) oraz w spoczynku. Dostęp do danych mają wyłącznie autoryzowani członkowie zespołu OH! Club.', order: 1 },
    { title: 'Podstawa prawna (RODO)', body: 'Przetwarzamy Twoje dane na podstawie art. 6 ust. 1 lit. a RODO — Twojej dobrowolnej zgody — oraz art. 9 ust. 2 lit. a RODO w zakresie danych o zdrowiu. Masz prawo do dostępu, sprostowania, usunięcia i przenoszenia danych, a także do wycofania zgody w dowolnym momencie.', order: 2 },
    { title: 'Dane zdrowotne', body: 'Dane dotyczące cyklu, nawyków i samopoczucia traktujemy ze szczególną starannością. Nie sprzedajemy, nie udostępniamy ani nie analizujemy ich w celach reklamowych. Są wykorzystywane wyłącznie do personalizacji Twojego programu w aplikacji.', order: 3 },
    { title: 'Udostępnianie danych', body: 'Nie sprzedajemy Twoich danych osobowych. Korzystamy z usług podwykonawców (Firebase, RevenueCat) wyłącznie w zakresie niezbędnym do działania aplikacji, przy zachowaniu odpowiednich umów powierzenia przetwarzania danych.', order: 4 },
    { title: 'Usunięcie konta', body: 'Możesz w każdej chwili usunąć swoje konto i wszystkie powiązane dane bezpośrednio z poziomu aplikacji (sekcja "Usuń dane"). Po usunięciu Twoje dane są trwale kasowane z naszych serwerów w ciągu 30 dni.', order: 5 },
    { title: 'Kontakt', body: 'W sprawach dotyczących prywatności skontaktuj się z nami pod adresem: kontakt@ohclub.pl', order: 6 },
];

const FAQ_ITEMS = [
    { question: 'Czym jest OH! Club?', answer: 'OH! Club to aplikacja wspierająca kobiety w budowaniu zdrowych nawyków dopasowanych do faz cyklu miesiączkowego. Oferujemy spersonalizowane plany żywieniowe, bibliotekę nawyków i śledzenie cyklu.', order: 0 },
    { question: 'Czy aplikacja zastępuje lekarza lub dietetyka?', answer: 'Nie. OH! Club ma wyłącznie charakter edukacyjny i wspierający zdrowy styl życia. Nie jest wyrobem medycznym. Wszystkie zalecenia skonsultuj ze swoim lekarzem lub specjalistą przed wprowadzeniem zmian w diecie czy stylu życia.', order: 1 },
    { question: 'Jak działa personalizacja planu?', answer: 'Po wypełnieniu quizu onboardingowego aplikacja przypisuje Ci jeden z czterech programów (Opanuj Cukier, Opanuj Skórę, Opanuj Stres, Glow-Up). Plan nawyków i jadłospis są dostosowane do Twojego profilu i fazy cyklu.', order: 2 },
    { question: 'Co różni plan Basic od Premium?', answer: 'Basic daje dostęp do wszystkich nawyków systemowych, jadłospisu na 7 dni, bazy wiedzy, śledzenia cyklu i czatu z ekspertką (10 wiad./mies.). Premium odblokuje dodatkowo: nielimitowane wymiany nawyków, inteligentną listę zakupów z kategoriami i czat bez limitu.', order: 3 },
    { question: 'Jak anulować subskrypcję?', answer: 'Subskrypcją zarządzasz bezpośrednio w App Store (iOS) lub Google Play (Android). W aplikacji możesz przejść do Profilu → Ustawienia profilu → Zarządzaj subskrypcją.', order: 4 },
    { question: 'Czy mogę przywrócić zakupy po reinstalacji?', answer: 'Tak. W ekranie wyboru planu znajdziesz przycisk "Przywróć zakupy". Działa on dla zakupów powiązanych z tym samym Apple ID lub kontem Google Play.', order: 5 },
    { question: 'Jak działa śledzenie cyklu?', answer: 'Podajesz datę ostatniej miesiączki i długość cyklu. Aplikacja wyznacza fazy (miesiączka, folikularną, owulacyjną, lutealną) i dopasowuje do nich propozycje nawyków oraz jadłospis.', order: 6 },
    { question: 'Czy moje dane są bezpieczne?', answer: 'Tak. Dane są szyfrowane i przechowywane w infrastrukturze Google Firebase zgodnie z RODO. Nie sprzedajemy danych osobowych ani zdrowotnych. Szczegóły w sekcji Prywatność.', order: 7 },
    { question: 'Jak skontaktować się z ekspertką?', answer: 'Czat z ekspertką dostępny jest w dolnym menu (ikona rozmowy). Ekspertki odpowiadają w ciągu 24–48 godzin w dni robocze.', order: 8 },
];

const SCREEN_TEXTS = [
    { key: 'privacy.tileSubtitle', value: 'Twoje dane, RODO' },
    { key: 'privacy.modalTitle', value: 'Prywatność i dane' },
    { key: 'privacy.banner', value: 'OH! Club nie jest aplikacją medyczną. Dane zdrowotne służą wyłącznie personalizacji programu — nie są udostępniane stronom trzecim ani wykorzystywane w celach reklamowych.' },
    { key: 'help.tileSubtitle', value: 'Najczęstsze pytania' },
    { key: 'help.modalTitle', value: 'Pomoc — FAQ' },
];

/** Upsert kolekcji: dopasowanie po `matchField`, set publishedAt → publikacja + sync. */
async function seedCollection(
    endpoint: string,
    matchField: string,
    rows: Record<string, unknown>[],
): Promise<void> {
    console.log(`\n📂 ${endpoint} (${rows.length} wpisów)`);

    // Pobierz istniejące (drafty też), by upsertować po polu naturalnym
    const existing: { documentId: string; match: unknown }[] = [];
    let page = 1;
    while (true) {
        const { data } = await withRetry(`fetch ${endpoint}`, () =>
            api.get(`/${endpoint}`, { params: { 'pagination[page]': page, 'pagination[pageSize]': 100, status: 'draft' } }),
        );
        existing.push(...data.data.map((e: any) => ({ documentId: e.documentId, match: e[matchField] })));
        if (data.meta.pagination.page >= data.meta.pagination.pageCount) break;
        page++;
    }

    for (const row of rows) {
        const body = { data: { ...row, publishedAt: new Date().toISOString() } };
        const match = existing.find((e) => String(e.match) === String(row[matchField]));
        const label = String(row[matchField]).slice(0, 40);
        try {
            if (match) {
                await withRetry(`update ${label}`, () => api.put(`/${endpoint}/${match.documentId}`, body));
                console.log(`  🔄 ${label}`);
            } else {
                await withRetry(`create ${label}`, () => api.post(`/${endpoint}`, body));
                console.log(`  ✅ ${label}`);
            }
        } catch (err: any) {
            console.error(`  ⚠️  ${label}:`, err.response?.data?.error?.message || err.message);
        }
        await sleep(250);
    }
}

async function main() {
    if (!STRAPI_API_TOKEN) {
        console.error('❌ Brak STRAPI_API_TOKEN w apps/cms/scripts/.env');
        process.exit(1);
    }
    console.log('🚀 Seedowanie treści Prywatność / Pomoc do Strapi...');
    console.log(`📡 Strapi: ${STRAPI_URL}`);

    await seedCollection('privacy-sections', 'title', PRIVACY_SECTIONS);
    await seedCollection('faq-items', 'question', FAQ_ITEMS);
    await seedCollection('screen-texts', 'key', SCREEN_TEXTS);

    console.log('\n🎉 Gotowe! Publikacja wyzwala sync do Firestore (privacy_sections / faq_items / screen_texts).');
}

main().catch((err) => {
    console.error('Błąd krytyczny:', err.response?.data || err.message);
    process.exit(1);
});
