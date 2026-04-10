import 'dotenv/config';
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

// Initialize Firebase Admin using environment variables
if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();

    if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
        console.log('[SEEDER] Firebase initialized from Env.');
    } else {
        console.warn('[SEEDER] Firebase credentials missing in Env. Skipping Firebase sync.');
    }
}
const db = admin.firestore();

// CLI Configuration
const args = process.argv.slice(2);
const FLAGS = {
    clean: args.includes('--clean'),
    sync: args.includes('--sync'),
    noFirebase: args.includes('--no-firebase'),
    help: args.includes('--help') || args.includes('-h')
};

if (FLAGS.help) {
    console.log(`
[SEEDER] Usage: npx tsx scripts/seed-recipes.ts [FLAGS]
Flags:
  --clean       Enable Smart Garbage Collector (Phase 0) to delete invalid ingredients.
  --sync        Force relationship synchronization for all recipes.
  --no-firebase Skip synchronization to Firestore.
  --help, -h    Show this help message.
`);
    process.exit(0);
}

const UNIT_CONVERSIONS: Record<string, number> = {
    'g': 1,
    'ml': 1,
    'lyzka': 15,
    'lyzeczka': 5,
    'szklanka': 250,
    'szczypta': 1,
    'garstka': 30,
    'plaster': 20,
};

function isGarbageIngredient(name: string): boolean {
    const n = name.toLowerCase();
    return (
        name.length > 50 || 
        name.includes(';') || 
        name.includes(':') || 
        (name.includes(',') && name.length > 30) ||
        name.startsWith('(') || 
        name.endsWith('-') ||
        n.includes('blaszkę') ||
        n.includes('łyżek') || n.includes('sztuk') || n.includes('opakow') || 
        (n.length < 3) 
    );
}

async function runSeeder(strapi: Core.Strapi) {
    const recipesDataPath = path.resolve(process.cwd(), 'data/recipes.json');
    
    if (!fs.existsSync(recipesDataPath)) {
        console.log('No recipes.json found in data folder.');
        return;
    }

    if (FLAGS.clean) {
        console.log('[SEEDER] Phase 0: Running Smart Garbage Collector (DISABLED BY DEFAULT)...');
        const suspects = await strapi.documents('api::ingredient.ingredient' as any).findMany({
            filters: {
                kcal: 0
            },
            limit: -1
        });

        if (suspects.length > 0) {
            let deletedCount = 0;
            for (const s of suspects as any[]) {
                const name = s.name || '';
                if (isGarbageIngredient(name)) {
                    try {
                        console.log(`[SEEDER] Deleting garbage: "${name}"`);
                        await strapi.documents('api::ingredient.ingredient' as any).delete({
                            documentId: s.documentId
                        });
                        // Also delete from Firebase if it exists
                        if (!FLAGS.noFirebase && db) {
                            await db.collection('ingredients').doc(s.slug || s.documentId).delete().catch(() => {});
                        }
                        deletedCount++;
                    } catch (err: any) {
                        console.warn(`[SEEDER] Could not delete "${name}":`, err.message);
                    }
                }
            }
            console.log(`[SEEDER] Smart Garbage Collector finished. Deleted ${deletedCount} entries.`);
        }
    } else {
        console.log('[SEEDER] Skipping Garbage Collector (use --clean to enable).');
    }

    // 1. Clear Strapi recipes if importing fresh
    await strapi.db.query('api::recipe.recipe').deleteMany({});
    console.log('[SEEDER] Strapi recipes cleared.');


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
            // SKIP IF GARBAGE
            if (isGarbageIngredient(ingName)) {
                console.log(`[SEEDER] Skipping garbage ingredient creation: ${ingName}`);
                continue;
            }

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
    const CHUNK_SIZE = 5;

    async function calculateMacros(recipeIngredients: any[]) {
        let totalKcal = 0;
        let protein = 0, carbs = 0, fat = 0, fiber = 0;

        for (const rip of recipeIngredients) {
            const ing = ingMap.get(rip.name.toLowerCase()) || ingMap.get(rip.ingredient);
            if (!ing) continue;

            const amount = parseFloat(rip.amount) || 0;
            const unit = rip.unit || 'g';
            let factor = 0;

            if (ing.unitType === 'piece') {
                if (unit === 'szt' || unit === 'opakowanie') {
                    factor = amount;
                } else if (UNIT_CONVERSIONS[unit]) {
                    factor = (amount * UNIT_CONVERSIONS[unit]) / (ing.averagePieceWeight || 100);
                } else {
                    factor = amount;
                }
            } else {
                let weightInGrams = (rip.weight && Number(rip.weight) > 0) ? Number(rip.weight) : (amount * (UNIT_CONVERSIONS[unit] || 1));
                if (!rip.weight && (unit === 'szt' || unit === 'opakowanie')) {
                    weightInGrams = amount * (ing.averagePieceWeight || 100);
                }
                factor = weightInGrams / 100;
            }

            totalKcal += (ing.kcal || 0) * factor;
            protein += (ing.protein || 0) * factor;
            carbs += (ing.carbs || 0) * factor;
            fat += (ing.fat || 0) * factor;
            fiber += (ing.fiber || 0) * factor;
        }

        return {
            kcal: Math.round(totalKcal),
            macros: {
                protein: Math.round(protein),
                carbs: Math.round(carbs),
                fat: Math.round(fat),
                fiber: Math.round(fiber),
            }
        };
    }

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
                const nutrition = await calculateMacros(processedIngredients);
                const ingredientIds = processedIngredients.map((ip: any) => ip.ingredient).filter(Boolean);
                
                // @ts-ignore
                const created = await strapi.documents('api::recipe.recipe' as any).create({
                    data: {
                        name: recipeData.name.substring(0, 255),
                        description: recipeData.description,
                        preparation: recipeData.preparation,
                        prepTime: recipeData.prepTime,
                        servings: recipeData.servings,
                        mealSlots: recipeData.mealSlot,
                        ingredients: processedIngredients,
                        used_ingredients: ingredientIds,
                        kcal: nutrition.kcal,
                        macros: nutrition.macros,
                        tags: (recipeData.tags || []).join(', ').substring(0, 255),
                        publishedAt: new Date(),
                    },
                    status: 'published'
                });

                // DIRECT SYNC TO FIREBASE
                if (!FLAGS.noFirebase && db) {
                    const docId = created.documentId;
                    const firebaseData = {
                        name: recipeData.name,
                        description: recipeData.description,
                        preparation: recipeData.preparation,
                        prepTime: recipeData.prepTime,
                        kcal: nutrition.kcal,
                        macros: nutrition.macros,
                        mealSlots: recipeData.mealSlot,
                        ingredients: processedIngredients.map(ip => ({
                            name: ip.name,
                            amount: ip.amount,
                            unit: ip.unit,
                            weight: ip.weight,
                            slug: ip.ingredient ? (ingMap.get(ip.ingredient)?.slug || ip.ingredient) : ''
                        })),
                        updatedAt: new Date().toISOString(),
                        source: 'seeder'
                    };
                    await db.collection('recipes').doc(docId).set(firebaseData);
                }

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
export { runSeeder };

// Standalone execution block
console.log('[DEBUG] Script path:', __filename);
if (require.main === module || require.main?.filename === __filename || process.argv[1].includes('seed-recipes')) {
    const { createStrapi } = require('@strapi/strapi');
    console.log('[SEEDER] Standalone execution detected.');
    
    async function main() {
        console.log('[SEEDER] Initializing Strapi instance...');
        const strapi = await createStrapi().load();
        
        try {
            await runSeeder(strapi);
        } catch (error) {
            console.error('[SEEDER] Critical error during run:', error);
        } finally {
            // Give it a moment to finish any log writes
            setTimeout(() => process.exit(0), 1000);
        }
    }
    
    main().catch(err => {
        console.error('[SEEDER] Startup error:', err);
        process.exit(1);
    });
}
