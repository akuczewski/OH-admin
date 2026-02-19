// Load environment variables early
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import axios from 'axios';
import admin from 'firebase-admin';
import OpenAI from 'openai';

// Manually initialize Firebase for standalone script execution if needed
if (!admin.apps.length) {
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
    console.log('[IMPORT] Fetching ingredient library from Firestore...');
    const snapshot = await db.collection('ingredients').get();
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            name: data.name,
            slug: data.slug,
            kcal: data.kcal,
            protein: data.protein,
            carbs: data.carbs,
            fat: data.fat,
            fiber: data.fiber,
            unitType: data.unitType
        };
    });
}

/**
 * Formatuje listę składników dla promptu AI
 */
function formatIngredientsForAI(ingredients: IngredientReference[]): string {
    return ingredients.map(ing => `- ${ing.name} (slug: ${ing.slug})`).join('\n');
}

/**
 * Funkcja parsująca przepis za pomocą GPT-4o
 */
async function parseRecipeWithAI(recipeInput: string, library: IngredientReference[]) {
    const libraryText = formatIngredientsForAI(library);

    const prompt = `
Jesteś ekspertem dietetykiem OH! Club. Twoim zadaniem jest przetworzenie podanego przepisu na ustrukturyzowany format JSON zgodny z naszym systemem.

Dostępna baza składników (UŻYWAJ TYLKO TYCH NAZW):
${libraryText}

Instrukcje:
1. Rozpoznaj składniki w przepisie i dopasuj je do naszej bazy. Jeśli składnika nie ma w bazie, wybierz najbardziej zbliżony (np. "masło osełkowe" -> "masło").
2. Oblicz makroskładniki (kcal, białko, węgle, tłuszcz, błonnik) dla CAŁEGO przepisu na podstawie ilości.
3. Jednostki miary (unit) muszą być jednymi z: g, ml, szt, lyzka, lyzeczka, szklanka, szczypta, plaster, garstka, opakowanie.
4. Przygotowanie (preparation) to tablica ciągów znaków (kroki).
5. MealSlot musi być jednym z: breakfast, lunch, dinner, snack.

Format wyjściowy JSON:
{
  "name": "Nazwa przepisu",
  "description": "Krótki, zachęcający opis",
  "kcal": 450,
  "macros": {
    "protein": 20,
    "carbs": 50,
    "fat": 15,
    "fiber": 5
  },
  "ingredients": [
    { "name": "slug-skladnika", "amount": 100, "unit": "g" }
  ],
  "preparation": ["Krok 1", "Krok 2"],
  "prepTime": 20,
  "servings": 1,
  "mealSlot": "lunch",
  "tags": "low-ig, keto"
}

Przepis do przetworzenia:
${recipeInput}
`;

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: "Jesteś asystentem API zwracającym tylko czysty JSON." },
            { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
}

/**
 * Wysyła przepis do Strapi
 */
async function sendToStrapi(recipeData: any) {
    if (!STRAPI_API_TOKEN) {
        throw new Error('STRAPI_API_TOKEN is missing in .env');
    }

    try {
        const response = await axios.post(`${STRAPI_URL}/api/recipes`, {
            data: {
                ...recipeData,
                status: 'draft' // Zawsze jako draft do weryfikacji przez eksperta
            }
        }, {
            headers: {
                Authorization: `Bearer ${STRAPI_API_TOKEN}`
            }
        });
        return response.data;
    } catch (error: any) {
        console.error('[STRAPI] Error creating recipe:', error.response?.data || error.message);
        throw error;
    }
}

async function bulkImport(recipeInputs: string[]) {
    console.log(`[IMPORT] Starting bulk import of ${recipeInputs.length} recipes...`);
    const library = await getIngredientLibrary();

    for (const input of recipeInputs) {
        console.log(`[IMPORT] Processing: ${input.substring(0, 30)}...`);
        try {
            const parsed = await parseRecipeWithAI(input, library);
            console.log('\n--- PARSED RESULT ---');
            console.log(JSON.stringify(parsed, null, 2));
            console.log('----------------------\n');

            if (!STRAPI_API_TOKEN) {
                console.warn('[SKIP] Skipping Strapi save because STRAPI_API_TOKEN is missing.');
                continue;
            }

            const result = await sendToStrapi(parsed);
            console.log(`[STRAPI] Created: ${parsed.name} (ID: ${result.data.id})`);
        } catch (error) {
            console.error(`[IMPORT] Failed to process: ${input.substring(0, 30)}`, error);
        }
    }
}

// Przykład użycia
const exampleRecipes = [
    "Sałatka z komosą ryżową i pieczonymi batatami. Składniki: 50g komosy, 1 średni batat, garść rukoli, łyżka oliwy, szczypta soli. Bataty upiec w 200st przez 20 min. Komosę ugotować. Wymieszać wszystko z oliwą.",
];

if (require.main === module) {
    if (!process.env.STRAPI_API_TOKEN) {
        console.warn('STRAPI_API_TOKEN is missing! Script will only parse without saving.');
    }
    bulkImport(exampleRecipes).catch(console.error);
}
