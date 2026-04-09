// Load environment variables early
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import axios from 'axios';
import admin from 'firebase-admin';
import fs from 'fs';
import { convert } from 'html-to-text';
import OpenAI from 'openai';

// Manually initialize Firebase for standalone script execution if needed
if (!admin.apps.length) {
    const serviceAccountPath = path.join(__dirname, '../../oh-club-firebase-adminsdk-fbsvc-aec7f20fc0.json');
    if (fs.existsSync(serviceAccountPath)) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccountPath),
        });
        console.log('[FIREBASE] Admin SDK initialized from JSON file.');
    } else {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '')
            : undefined;

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            }),
        });
        console.log('[FIREBASE] Admin SDK initialized from env.');
    }
}

const db = admin.firestore();
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN; // User must provide this

interface IngredientReference {
    name: string;
    slug: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    unitType: string;
}

/**
 * Pobiera wszystkie składniki z Firestore jako referencję dla AI
 */
async function getIngredientLibrary(): Promise<IngredientReference[]> {
    console.log('[IMPORT] Bypassing Firestore ingredient library (Invalid Credentials)...');
    return [];
}

function formatIngredientsForAI(ingredients: IngredientReference[]): string {
    return ingredients.map(ing => ing.name).join(', ');
}

async function fetchUrlContent(url: string): Promise<string> {
    console.log(`[FETCH] Fetching content from: ${url}`);
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });

        return convert(response.data, {
            wordwrap: 130,
            selectors: [
                { selector: 'a', options: { ignoreHref: true } },
                { selector: 'img', format: 'skip' },
                { selector: 'nav', format: 'skip' },
                { selector: 'footer', format: 'skip' },
                { selector: 'header', format: 'skip' },
                { selector: 'script', format: 'skip' },
                { selector: 'style', format: 'skip' },
                { selector: 'aside', format: 'skip' }
            ]
        });
    } catch (error: any) {
        console.error(`[FETCH] Error: ${error.message}`);
        return '';
    }
}

/**
 * Funkcja parsująca przepis za pomocą GPT-4o
 */
async function parseRecipeWithAI(recipeInput: string, library: IngredientReference[], sourceUrl: string, targetSlot: string) {
    const libraryText = formatIngredientsForAI(library);

    const prompt = `
Jesteś ekspertem dietetykiem OH! Club. Twoim zadaniem jest przetworzenie podanego przepisu na ustrukturyzowany format JSON zgodny z naszym systemem.

Dostępna baza składników (UŻYWAJ DOKŁADNIE TYCH NAZW):
${libraryText}

Instrukcje:
1. Rozpoznaj składniki w przepisie i dopasuj je do naszej bazy. Wybierz NAJBARDZIEJ PASUJĄCĄ nazwę z powyższej listy.
2. Oblicz makroskładniki (kcal, białko, węgle, tłuszcz, błonnik) dla CAŁEGO przepisu na podstawie ilości.
3. Jednostki miary (unit) muszą być jednymi z: g, ml, szt, lyzka, lyzeczka, szklanka, szczypta, plaster, garstka, opakowanie.
4. Przygotowanie (preparation) to ciąg znaków w formacie Markdown (kolejne kroki od nowej linii).
5. MealSlot - BEZWZGLĘDNIE USTAW NA: "${targetSlot}".
6. Spróbuj zidentyfikować autora przepisu (person/blog name). Jeśli nie znajdziesz, użyj domeny z URL (jeśli podany) lub zostaw puste.

Format wyjściowy JSON:
{
  "name": "Nazwa przepisu",
  "description": "Krótki opis",
  "kcal": 450,
  "macros": { "protein": 20, "carbs": 50, "fat": 15, "fiber": 5 },
  "ingredients": [
    { "name": "DOKŁADNA NAZWA Z LISTY", "amount": 100, "unit": "g" }
  ],
  "preparation": "Krok 1\\nKrok 2",
  "prepTime": 20,
  "servings": 1,
  "mealSlot": "${targetSlot}",
  "tags": "niski-ig",
  "author": "Nazwa Autora/Bloga"
}

Przepis:
${recipeInput}
Źródło: ${sourceUrl}
`;

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: "Jesteś asystentem API zwracającym tylko czysty JSON. Używaj tylko nazw z dostarczonej listy." },
            { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    result.sourceUrl = sourceUrl;
    // Enforce safety fallback
    result.mealSlot = targetSlot;

    return result;
}

function normalizeRecipeData(data: any, library: IngredientReference[]) {
    // Jeśli preparation jest tablicą, złącz ją w stringa
    if (Array.isArray(data.preparation)) {
        data.preparation = data.preparation.join('\n');
    }

    // MAPOWANIE NAZW NA SLUGI
    if (data.ingredients) {
        data.ingredients = data.ingredients.map((ing: any) => {
            const found = library.find(l => l.name.toLowerCase() === ing.name.toLowerCase());
            return {
                ...ing,
                name: found ? found.slug : ing.name // fallback do oryginalnej nazwy jeśli nie znaleziono
            };
        });
    }

    return data;
}

async function sendToStrapi(recipeData: any, library: IngredientReference[]) {
    if (!STRAPI_API_TOKEN) {
        throw new Error('STRAPI_API_TOKEN is missing in .env');
    }

    const normalizedData = normalizeRecipeData(recipeData, library);

    try {
        const response = await axios.post(`${STRAPI_URL}/api/recipes`, {
            data: {
                ...normalizedData,
                publishedAt: null // Explicitly as draft
            }
        }, {
            headers: {
                Authorization: `Bearer ${STRAPI_API_TOKEN}`
            }
        });
        return response.data;
    } catch (error: any) {
        if (error.response) {
            console.error('[STRAPI] Error details:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('[STRAPI] Error:', error.message);
        }
        throw error;
    }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface RecipeImportItem {
    url: string;
    slot: string;
}

async function bulkImportUrls(items: RecipeImportItem[]) {
    console.log(`[IMPORT] Starting specialized import of ${items.length} items to local JSON file...`);
    const library = await getIngredientLibrary();
    const importResults: any[] = [];

    for (const item of items) {
        const inputUrl = item.url.startsWith('http') ? item.url : `https://${item.url}`;
        console.log(`[IMPORT] Processing: ${inputUrl} [${item.slot}]`);

        try {
            const content = await fetchUrlContent(inputUrl);
            if (!content) {
                console.error('[IMPORT] Failed to fetch URL content. Skipping.');
                continue;
            }

            const parsed = await parseRecipeWithAI(content, library, inputUrl, item.slot);
            console.log('\n--- PARSED RESULT ---');
            console.log(JSON.stringify(parsed, null, 2));
            console.log('----------------------\n');

            importResults.push(parsed);
            console.log(`[MEMORY] Saved to memory: ${parsed.name}`);

            console.log('[IMPORT] Waiting 3s for next item (API limits)...');
            await sleep(3000);
        } catch (error) {
            console.error(`[IMPORT] Failed: ${item.url}`, error);
            await sleep(10000);
        }
    }

    fs.writeFileSync(path.join(__dirname, 'draft-recipes.json'), JSON.stringify(importResults, null, 2));
    console.log(`[IMPORT] Finished all URLs. Saved to ${path.join(__dirname, 'draft-recipes.json')}`);
}

const targetItems: RecipeImportItem[] = [
    { slot: "sniadanie", url: "https://www.kwestiasmaku.com/przepis/jaglanka-z-sosem-tahini-i-granatem" },
    { slot: "obiad", url: "https://aniagotuje.pl/przepis/soczyste-kotleciki-z-filetu-z-indyka-z-ryzem" },
    { slot: "przekaska", url: "https://www.kwestiasmaku.com/przepis/korzenne-brownie-z-suszonymi-sliwkami" },
    { slot: "kolacja", url: "https://www.kwestiasmaku.com/przepis/hiszpanski-kociolek" },
    { slot: "przekaska", url: "https://www.zmiksowane.com/przepis/pasztet-z-bialej-fasoli-z-pieczarkami/" },
    { slot: "sniadanie-2", url: "https://www.mykitchenlife.pl/nutella-z-awokado/" },
    { slot: "obiad", url: "https://www.kwestiasmaku.com/kuchnia_angielska/kurczak_tikka_masala/przepis.html" },
    { slot: "przekaska", url: "https://www.kwestiasmaku.com/zielony_srodek/kalafior/krem_z_kalafiora/przepis.html" },
    { slot: "kolacja", url: "https://bezbez.pl/diety/bez-cukru/bezglutenowe-nalesniki-pomaranczowe-z-makiem/" },
    { slot: "sniadanie-2", url: "https://www.doradcasmaku.pl/przepis-srodziemnomorska-salatka-z-platkami-parmezanu-oliwkami-rukola-i-orzechami-pinii-372503" },
    { slot: "obiad", url: "https://zpierwszegotloczenia.pl/przepis/pappardelle-z-borowikami-i-poledwiczkami#" },
    { slot: "przekaska", url: "https://dietetykpowszechny.pl/fit-tiramisu/" },
    { slot: "kolacja", url: "https://beszamel.se.pl/przepisy/dania-glowne-rybne/ryba-w-sosie-curry-wedlug-magdy-gessler-re-LEdc-d8pS-KiEh.html" },
];

if (require.main === module) {
    if (!process.env.STRAPI_API_TOKEN) {
        console.warn('STRAPI_API_TOKEN is missing! Script will only parse without saving.');
    }
    bulkImportUrls(targetItems).catch(console.error);
}
