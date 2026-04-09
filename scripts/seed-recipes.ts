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

    // 3. Import
    console.log('[SEEDER] Starting import phase...');
    const recipesJson = JSON.parse(fs.readFileSync(recipesDataPath, 'utf8'));
    
    // Cache ingredients in memory for speed
    console.log('[SEEDER] Fetching ingredients for cache...');
    const allIngs = await strapi.documents('api::ingredient.ingredient' as any).findMany({ limit: -1 });
    const ingMap = new Map();
    allIngs.forEach((i: any) => ingMap.set(i.name.toLowerCase(), i));

    let addedCount = 0;
    for (const recipeData of recipesJson) {
        const processedIngredients = [];
        for (const ing of recipeData.ingredients) {
            const ingName = ing.name;
            const normalizedName = ingName.toLowerCase();
            
            let targetIng = ingMap.get(normalizedName);
            
            if (!targetIng) {
                console.log(`[SEEDER] Creating missing ingredient: ${ingName}`);
                // @ts-ignore
            // @ts-ignore
                targetIng = await strapi.documents('api::ingredient.ingredient' as any).create({
                    data: {
                        name: ingName.substring(0, 255),
                        slug: normalizedName.replace(/\s+/g, '-').replace(/[^\w-]/g, '').substring(0, 255),
                        category: 'Inne',
                        unitType: (ing.unit === 'szt' || ing.unit === 'opakowanie') ? 'piece' : 'weight',
                        kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
                        publishedAt: new Date(),
                    },
                    status: 'published'
                });
                ingMap.set(normalizedName, targetIng);
            }

            processedIngredients.push({
                ...ing,
                __component: 'shared.ingredient',
                ingredient: targetIng.documentId // Strapi 5 relation
            });
        }

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
            if (addedCount % 10 === 0) console.log(`[SEEDER] Processed ${addedCount}/${recipesJson.length}...`);
        } catch (e) {
            console.error(`[SEEDER] Failed for ${recipeData.name}:`, e);
        }
    }

    console.log(`[SEEDER] COMPLETED. Seeded ${addedCount} recipes.`);
}

// Wrapper to run via Strapi boot if needed or standalone
export default runSeeder;
