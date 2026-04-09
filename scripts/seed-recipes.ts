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

import runRecovery from './restore-core-ingredients';

async function runSeeder(strapi: Core.Strapi) {
    // Phase -1: Recovery of core ingredients with correct macros
    await runRecovery(strapi);

    const recipesDataPath = path.resolve(process.cwd(), 'data/recipes.json');
    
    if (!fs.existsSync(recipesDataPath)) {
        console.log('No recipes.json found in data folder.');
        return;
    }

    console.log('[SEEDER] Starting cleaning phase...');
    
    // 1. Clear Strapi
    await strapi.db.query('api::recipe.recipe').deleteMany({});
    console.log('[SEEDER] Strapi recipes cleared.');

    // Phase 0: Smart Garbage Collector (Cleanup of legacy parsing errors)
    console.log('[SEEDER] Phase 0: Running Smart Garbage Collector...');
    const suspects = await strapi.documents('api::ingredient.ingredient' as any).findMany({
        filters: {
            kcal: 0 // Only placeholders created by previous seeder runs
        },
        limit: -1
    });

    if (suspects.length > 0) {
        let deletedCount = 0;
        for (const s of suspects as any[]) {
            const name = s.name || '';
            const isGarbage = 
                name.length > 50 || 
                name.includes(';') || 
                name.includes(':') || 
                (name.includes(',') && name.length > 30) ||
                name.startsWith('(') || 
                name.endsWith('-') ||
                name.toLowerCase().includes('blaszkę');

            if (isGarbage) {
                try {
                    console.log(`[SEEDER] Deleting garbage: "${name}"`);
                    await strapi.documents('api::ingredient.ingredient' as any).delete({
                        documentId: s.documentId
                    });
                    // Also delete from Firebase if it exists
                    await db.collection('ingredients').doc(s.slug || s.documentId).delete().catch(() => {});
                    deletedCount++;
                } catch (err: any) {
                    console.warn(`[SEEDER] Could not delete "${name}":`, err.message);
                }
            }
        }
        console.log(`[SEEDER] Smart Garbage Collector finished. Deleted ${deletedCount} entries.`);
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
                        slug: slug,
                        category: 'Inne',
                        unitType: (ingUnitMap.get(ingName) === 'szt' || ingUnitMap.get(ingName) === 'opakowanie') ? 'piece' : 'weight',
                        kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
                        publishedAt: new Date(),
                    },
                    status: 'published'
                });
                ingMap.set(normalizedName, targetIng);
                ingMap.set(slug, targetIng);
            } catch (err: any) {
                console.error(`[SEEDER] Failed to create ingredient ${ingName}:`, err.message);
            }
        }
    }

    // Phase 2: Parallel Recipe Import in chunks
    console.log('[SEEDER] Phase 2: Creating recipes in parallel batches...');
    let addedCount = 0;
    const CHUNK_SIZE = 5; // Smaller chunks for reliability with new fields

    for (let i = 0; i < recipesJson.length; i += CHUNK_SIZE) {
        const chunk = recipesJson.slice(i, i + CHUNK_SIZE);
        
        await Promise.all(chunk.map(async (recipeData: any) => {
            const processedIngredients = recipeData.ingredients.map((ing: any) => {
                const normalizedName = ing.name.toLowerCase();
                const slug = normalizedName.replace(/\s+/g, '-').replace(/[^\w-]/g, '').substring(0, 255);
                const targetIng = ingMap.get(normalizedName) || ingMap.get(slug);
                return {
                    name: ing.name.substring(0, 255),
                    amount: ing.amount,
                    unit: ing.unit,
                    weight: ing.weight || 0.0,
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
