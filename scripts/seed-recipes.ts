import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

/**
 * seed-recipes.ts (REST-based)
 * 
 * Standalone script to import recipes from data/recipes.json into Strapi & Firebase.
 * Uses REST API to communicate with Strapi Cloud.
 */

// Initialize Firebase Admin
let db: any = null;
if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
        privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
    }

    if (projectId && clientEmail && privateKey) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    project_id: projectId,
                    client_email: clientEmail,
                    private_key: privateKey,
                } as any),
            });
            db = admin.firestore();
            console.log('[SEEDER] Firebase initialized.');
        } catch (e) {
            console.warn('[SEEDER] Firebase init failed, skipping Firebase sync.');
        }
    }
}

const STRAPI_URL = process.env.STRAPI_URL;
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;
const headers = {
    'Authorization': `Bearer ${STRAPI_TOKEN}`,
    'Content-Type': 'application/json'
};

const args = process.argv.slice(2);
const FLAGS = {
    clean: args.includes('--clean'),
    sync: args.includes('--sync'),
    noFirebase: args.includes('--no-firebase'),
};

const UNIT_CONVERSIONS: Record<string, number> = {
    'g': 1, 'ml': 1, 'lyzka': 15, 'lyzeczka': 5, 'szklanka': 250, 'szczypta': 1, 'garstka': 30, 'plaster': 20,
};

function isGarbageIngredient(name: string): boolean {
    const n = name.toLowerCase();
    return (
        name.length > 50 || name.includes(';') || name.includes(':') || 
        (name.includes(',') && name.length > 30) || name.startsWith('(') || 
        name.endsWith('-') || n.includes('blaszkę') || n.includes('łyżek') || 
        n.includes('sztuk') || n.includes('opakow') || (n.length < 3)
    );
}

async function runSeeder() {
    const recipesDataPath = path.resolve(process.cwd(), 'data/recipes.json');
    if (!fs.existsSync(recipesDataPath)) {
        console.log('No recipes.json found.');
        return;
    }

    if (!STRAPI_URL || !STRAPI_TOKEN) {
        console.error('Missing Strapi credentials.');
        return;
    }

    // 1. Clear Strapi recipes if importing fresh
    console.log('[SEEDER] Clearing Strapi recipes...');
    while (true) {
        const res = await fetch(`${STRAPI_URL}/api/recipes?pagination[pageSize]=100`, { headers });
        const json: any = await res.json();
        if (!json.data || json.data.length === 0) break;
        for (const item of json.data) {
            await fetch(`${STRAPI_URL}/api/recipes/${item.documentId}`, { method: 'DELETE', headers });
        }
    }

    const recipesJson = JSON.parse(fs.readFileSync(recipesDataPath, 'utf8'));
    
    // Phase 1: Pre-load ingredients
    console.log('[SEEDER] Phase 1: Pre-loading ingredients catalog...');
    const ingMap = new Map();
    const slugMap = new Map();
    
    let page = 1;
    while (true) {
        const res = await fetch(`${STRAPI_URL}/api/ingredient-catalogs?pagination[page]=${page}&pagination[pageSize]=100`, { headers });
        const json: any = await res.json();
        if (!json.data || json.data.length === 0) break;
        json.data.forEach((i: any) => {
            ingMap.set(i.name.toLowerCase().trim(), i);
            if (i.slug) slugMap.set(i.slug.toLowerCase(), i);
        });
        page++;
    }

    // Phase 2: Create Missing Ingredients
    console.log('[SEEDER] Phase 2: Resolving ingredients...');
    for (const r of recipesJson) {
        for (const ing of r.ingredients) {
            const normalizedName = ing.name.toLowerCase().trim();
            const slug = normalizedName.replace(/ł/g, 'l').replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            
            if (!ingMap.has(normalizedName) && !slugMap.has(slug)) {
                if (isGarbageIngredient(ing.name) || /\d/.test(ing.name)) continue;
                console.log(`[SEEDER] Creating ingredient: ${ing.name}`);
                const res = await fetch(`${STRAPI_URL}/api/ingredient-catalogs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        data: {
                            name: ing.name, slug, category: 'Inne',
                            unitType: (ing.unit === 'szt' || ing.unit === 'opakowanie') ? 'piece' : 'weight',
                            kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
                            publishedAt: new Date()
                        }
                    })
                });
                const json: any = await res.json();
                if (json.data) {
                    ingMap.set(normalizedName, json.data);
                    slugMap.set(slug, json.data);
                }
            }
        }
    }

    // Phase 3: Import Recipes
    console.log('[SEEDER] Phase 3: Importing recipes...');
    for (const recipeData of recipesJson) {
        const processedIngredients = recipeData.ingredients.map((ing: any) => {
            const normalizedName = ing.name.toLowerCase().trim();
            const slug = normalizedName.replace(/ł/g, 'l').replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            const targetIng = ingMap.get(normalizedName) || slugMap.get(slug);
            return {
                name: ing.name,
                amount: ing.amount,
                unit: ing.unit,
                weight: ing.weight || 0,
                __component: 'shared.ingredient',
                ingredient: targetIng?.documentId || targetIng?.id
            };
        }).filter((ing: any) => ing.ingredient);

        if (processedIngredients.length === 0) {
            console.log(`[SEEDER] Skipping ${recipeData.name} - no valid ingredients.`);
            continue;
        }

        try {
            const res = await fetch(`${STRAPI_URL}/api/recipes`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    data: {
                        name: recipeData.name,
                        description: recipeData.description,
                        preparation: recipeData.preparation,
                        prepTime: recipeData.prepTime,
                        servings: recipeData.servings,
                        mealSlots: recipeData.mealSlot,
                        ingredients: processedIngredients,
                        used_ingredients: processedIngredients.map(i => i.id || i.ingredient), // Use id if available
                        kcal: 0,
                        macros: { protein: 0, carbs: 0, fat: 0, fiber: 0 },
                        tags: (recipeData.tags || []).join(', '),
                    }
                })
            });
            const json: any = await res.json();

            if (json.data && json.data.documentId) {
                // PUBLISH
                await fetch(`${STRAPI_URL}/api/recipes/${json.data.documentId}/actions/publish`, {
                    method: 'POST',
                    headers
                });

                if (db && !FLAGS.noFirebase) {
                    const docId = json.data.documentId;
                    await db.collection('recipes').doc(docId).set({
                        ...recipeData,
                        kcal: 0,
                        macros: { protein: 0, carbs: 0, fat: 0, fiber: 0 },
                        ingredients: processedIngredients,
                        updatedAt: new Date().toISOString()
                    });
                }
            }
            console.log(`[SEEDER] Imported: ${recipeData.name}`);
        } catch (e: any) {
            console.error(`[SEEDER] Failed ${recipeData.name}: ${e.message}`);
        }
    }
    console.log('[SEEDER] DONE.');
}

runSeeder().catch(console.error);
