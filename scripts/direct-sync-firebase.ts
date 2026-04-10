import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

/**
 * direct-sync-firebase.ts
 * 
 * Standalone script to sync recipes from data/recipes.json DIRECTLY to Firebase.
 * This bypasses Strapi boot issues and fixes the mobile app data immediately.
 */

if (!admin.apps.length) {
    const cleanEnv = (val?: string) => val?.trim().replace(/^"|"$/g, '');
    
    const projectId = cleanEnv(process.env.FIREBASE_PROJECT_ID);
    const clientEmail = cleanEnv(process.env.FIREBASE_CLIENT_EMAIL);
    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    const privateKey = cleanEnv(rawKey)?.replace(/\\n/g, '\n');

    console.log(`[DEBUG] Project: ${projectId}`);
    console.log(`[DEBUG] Email: ${clientEmail}`);
    console.log(`[DEBUG] Key starts with: ${privateKey?.substring(0, 30)}...`);
    console.log(`[DEBUG] Key length: ${privateKey?.length}`);

    if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
            credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        });
        console.log(`[SYNC] Firebase initialized for project: ${projectId}`);
    } else {
        console.error('[SYNC] Missing Firebase credentials.');
        process.exit(1);
    }
}
const db = admin.firestore();

const UNIT_CONVERSIONS: Record<string, number> = {
    'g': 1, 'ml': 1, 'lyzka': 15, 'lyzeczka': 5, 'szklanka': 250, 'szczypta': 1, 'garstka': 30, 'plaster': 20,
};

async function runSync() {
    const recipesDataPath = path.resolve(process.cwd(), 'data/recipes.json');
    if (!fs.existsSync(recipesDataPath)) {
        console.error('No recipes.json found.');
        return;
    }

    const recipesJson = JSON.parse(fs.readFileSync(recipesDataPath, 'utf8'));

    // 1. Fetch ALL ingredients from Firestore to have macro data
    console.log('[SYNC] Fetching ingredients for macro calculations...');
    const ingSnapshot = await db.collection('ingredients').get();
    const ingMap = new Map();
    ingSnapshot.docs.forEach(doc => {
        const data = doc.data();
        ingMap.set(data.name.toLowerCase(), data);
        if (data.slug) ingMap.set(data.slug.toLowerCase(), data);
    });
    console.log(`[SYNC] Loaded ${ingMap.size} ingredient mappings.`);

    // 2. Sync Recipes
    console.log(`[SYNC] Starting sync for ${recipesJson.length} recipes...`);
    let count = 0;

    for (const r of recipesJson) {
        let totalKcal = 0;
        let p = 0, c = 0, f = 0, b = 0;

        const processedIngredients = r.ingredients.map((ing: any) => {
            const master = ingMap.get(ing.name.toLowerCase());
            if (master) {
                const amount = parseFloat(ing.amount) || 0;
                const unit = ing.unit || 'g';
                let factor = 0;

                if (master.unitType === 'piece') {
                    if (unit === 'szt' || unit === 'opakowanie') {
                        factor = amount;
                    } else if (UNIT_CONVERSIONS[unit]) {
                        factor = (amount * UNIT_CONVERSIONS[unit]) / (master.averagePieceWeight || 100);
                    } else { factor = amount; }
                } else {
                    let weightInGrams = (ing.weight && Number(ing.weight) > 0) ? Number(ing.weight) : (amount * (UNIT_CONVERSIONS[unit] || 1));
                    if (!ing.weight && (unit === 'szt' || unit === 'opakowanie')) {
                        weightInGrams = amount * (master.averagePieceWeight || 100);
                    }
                    factor = weightInGrams / 100;
                }

                totalKcal += (master.kcal || 0) * factor;
                p += (master.protein || 0) * factor;
                c += (master.carbs || 0) * factor;
                f += (master.fat || 0) * factor;
                b += (master.fiber || 0) * factor;

                return {
                    name: ing.name,
                    amount: ing.amount,
                    unit: ing.unit,
                    weight: ing.weight || (factor * 100),
                    slug: master.slug || master.id
                };
            }
            return { name: ing.name, amount: ing.amount, unit: ing.unit, weight: ing.weight || 0 };
        });

        const nutrition = {
            kcal: Math.round(totalKcal),
            macros: {
                protein: Math.round(p),
                carbs: Math.round(c),
                fat: Math.round(f),
                fiber: Math.round(b)
            }
        };

        const docId = r.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

        await db.collection('recipes').doc(docId).set({
            name: r.name,
            description: r.description,
            preparation: r.preparation,
            prepTime: r.prepTime,
            kcal: nutrition.kcal,
            macros: nutrition.macros,
            mealSlots: r.mealSlot || [],
            ingredients: processedIngredients,
            updatedAt: new Date().toISOString(),
            source: 'direct-sync'
        }, { merge: true });

        count++;
        if (count % 50 === 0) console.log(`[SYNC] Progress: ${count}/${recipesJson.length}`);
    }

    console.log(`[SYNC] COMPLETED. Finished syncing ${count} recipes.`);
}

runSync().catch(console.error);
