import type { Core } from '@strapi/strapi';
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

/**
 * seed-recipes.ts
 * 
 * Standalone script to import recipes from data/recipes.json into Strapi & Firebase.
 * Run with: npx tsx scripts/seed-recipes.ts
 */

const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath)),
    });
}
const db = admin.firestore();

async function runSeeder(strapi: Core.Strapi) {
    const recipesDataPath = path.resolve(process.cwd(), 'data/recipes.json');
    
    if (!fs.existsSync(recipesDataPath)) {
        console.log('No recipes.json found in data folder.');
        return;
    }

    console.log('[SEEDER] Starting cleaning phase...');
    
    // 1. Clear Strapi
    await strapi.db.query('api::recipe.recipe').deleteMany({});
    console.log('[SEEDER] Strapi recipes cleared.');

    // 2. Clear Firebase
    const snapshot = await db.collection('recipes').get();
    if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`[SEEDER] Deleted ${snapshot.size} Firebase recipes.`);
    }

    // Phase 0: Cleanup of garbage ingredients (those with , : ; or brackets)
    console.log('[SEEDER] Phase 0: Cleanup of garbage ingredients...');
    const badIngredients = await strapi.documents('api::ingredient.ingredient' as any).findMany({
        filters: {
            $or: [
                { name: { $contains: ',' } },
                { name: { $contains: ':' } },
                { name: { $contains: ';' } },
                { name: { $contains: '(' } },
                { name: { $contains: ')' } }
            ]
        },
        limit: -1
    });

    if (badIngredients.length > 0) {
        console.log(`[SEEDER] Found ${badIngredients.length} garbage ingredients. Deleting...`);
        for (const bad of badIngredients) {
            try {
                await strapi.documents('api::ingredient.ingredient' as any).delete({
                    documentId: (bad as any).documentId
                });
                await db.collection('ingredients').doc((bad as any).slug || (bad as any).documentId).delete();
            } catch (err: any) {
                console.warn(`[SEEDER] Failed to delete garbage ingredient ${(bad as any).name}:`, err.message);
            }
        }
        console.log('[SEEDER] Cleanup completed.');
    }

    // 3. Import
    console.log('[SEEDER] Starting import phase...');
    const recipesJson = JSON.parse(fs.readFileSync(recipesDataPath, 'utf8'));
    
    // Phase 1: Pre-process ALL ingredients to avoid race conditions
    console.log('[SEEDER] Phase 1: Pre-creating ingredients...');
    const allIngs = await strapi.documents('api::ingredient.ingredient' as any).findMany({ limit: -1 });
    const ingMap = new Map();
    allIngs.forEach((i: any) => {
        ingMap.set(i.name.toLowerCase(), i);
        if (i.slug) ingMap.set(i.slug.toLowerCase(), i);
    });

    const uniqueIngredients = new Set<string>();
    const ingUnitMap = new Map<string, string>(); // name -> unit for unitType detection

    recipesJson.forEach((r: any) => {
        r.ingredients.forEach((ing: any) => {
            uniqueIngredients.add(ing.name);
            ingUnitMap.set(ing.name, ing.unit);
        });
    });

    for (const ingName of uniqueIngredients) {
        const normalizedName = ingName.toLowerCase();
        const slug = normalizedName.replace(/\s+/g, '-').replace(/[^\w-]/g, '').substring(0, 255);
        
        if (!ingMap.has(normalizedName) && !ingMap.has(slug)) {
            console.log(`[SEEDER] Creating missing ingredient: ${ingName}`);
            try {
                const targetIng = await strapi.documents('api::ingredient.ingredient' as any).create({
                    data: {
                        name: ingName.substring(0, 255),
                        slug: normalizedName.replace(/\s+/g, '-').replace(/[^\w-]/g, '').substring(0, 255),
                        category: 'Inne',
                        unitType: (ingUnitMap.get(ingName) === 'szt' || ingUnitMap.get(ingName) === 'opakowanie') ? 'piece' : 'weight',
                        kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
                        publishedAt: new Date(),
                    },
                    status: 'published'
                });
                ingMap.set(normalizedName, targetIng);
            } catch (err: any) {
                console.error(`[SEEDER] Failed to create ingredient ${ingName}:`, err.message);
            }
        }
    }

    // Phase 2: Parallel Recipe Import in chunks
    console.log('[SEEDER] Phase 2: Creating recipes in parallel batches...');
    let addedCount = 0;
    const CHUNK_SIZE = 10;

    for (let i = 0; i < recipesJson.length; i += CHUNK_SIZE) {
        const chunk = recipesJson.slice(i, i + CHUNK_SIZE);
        
        await Promise.all(chunk.map(async (recipeData: any) => {
            const processedIngredients = recipeData.ingredients.map((ing: any) => {
                const normalizedName = ing.name.toLowerCase();
                const slug = normalizedName.replace(/\s+/g, '-').replace(/[^\w-]/g, '').substring(0, 255);
                const targetIng = ingMap.get(normalizedName) || ingMap.get(slug);
                return {
                    ...ing,
                    __component: 'shared.ingredient',
                    ingredient: targetIng?.documentId
                };
            }).filter((ing: any) => ing.ingredient);

            try {
                // @ts-ignore
                await strapi.documents('api::recipe.recipe' as any).create({
                    data: {
                        name: recipeData.name.substring(0, 255),
                        description: recipeData.description,
                        preparation: recipeData.preparation,
                        prepTime: recipeData.prepTime,
                        servings: recipeData.servings,
                        mealSlots: recipeData.mealSlot,
                        ingredients: processedIngredients,
                        tags: (recipeData.tags || []).join(', ').substring(0, 255),
                        publishedAt: new Date(),
                    },
                    status: 'published'
                });
                addedCount++;
            } catch (e: any) {
                console.error(`[SEEDER] Failed for ${recipeData.name}:`, e.message);
            }
        }));

        console.log(`[SEEDER] Progress: ${addedCount}/${recipesJson.length}...`);
    }

    console.log(`[SEEDER] COMPLETED. Seeded ${addedCount} recipes.`);
}

// Wrapper to run via Strapi boot if needed or standalone
export default runSeeder;
