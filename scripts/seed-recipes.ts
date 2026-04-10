import 'dotenv/config';
import fs from 'fs';
import path from 'path';

/**
 * seed-recipes.ts
 * 
 * Imports recipes from data/recipes.json into Strapi Cloud.
 * - Phase 1: Loads existing ingredients from /api/food-items
 * - Phase 2: Creates CLEAN missing ingredients (no garbage, no grammage in names)
 * - Phase 3: Imports recipes with proper ingredient references
 */

const STRAPI_URL = process.env.STRAPI_URL;
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;
const headers = {
    'Authorization': `Bearer ${STRAPI_TOKEN}`,
    'Content-Type': 'application/json'
};

// ==================== INGREDIENT NAME CLEANING ====================

/** Strips trailing grammage like "60g", "100ml" from ingredient names */
function stripTrailingGrammage(name: string): string {
    return name.replace(/\s+\d+[.,]?\d*\s*(g|ml|kg|l)$/i, '').trim();
}

/** Removes parenthetical content like "(2 łyżki)" or "(100g)" */
function stripParentheses(name: string): string {
    return name.replace(/\s*\(.*?\)/g, '').trim();
}

/** Removes leading numbers like "2 " from "2 jajka" */
function stripLeadingNumbers(name: string): string {
    return name.replace(/^\d+[.,/]?\d*\s+/, '').trim();
}

/** Full cleaning pipeline for ingredient names */
function cleanIngredientName(raw: string): string {
    let name = raw.trim();
    // Remove newlines
    name = name.replace(/\n/g, '').trim();
    // Strip grammage at end
    name = stripTrailingGrammage(name);
    // Strip parenthetical content  
    name = stripParentheses(name);
    // Strip trailing grammage again (might be exposed after paren removal)
    name = stripTrailingGrammage(name);
    // Strip leading numbers
    name = stripLeadingNumbers(name);
    // Strip trailing junk
    name = name.replace(/[:;.,\-\s]+$/, '').trim();
    // Capitalize first letter
    if (name.length > 0) {
        name = name.charAt(0).toUpperCase() + name.slice(1);
    }
    return name;
}

/** Returns true if the name looks like garbage (units, fractions, headers, etc.) */
function isGarbage(name: string): boolean {
    const n = name.toLowerCase();
    if (name.length < 2 || name.length > 60) return true;
    if (/^\d/.test(name)) return true; // starts with digit
    if (/[½¼¾⅓⅔⅛]/.test(name)) return true; // Unicode fractions
    if (/\d/.test(name)) return true; // contains any digit
    // Common garbage patterns
    const garbagePatterns = [
        'szklanka', 'szklanki', 'szklanek',
        'łyżka', 'łyżki', 'łyżek', 'łyżeczka', 'łyżeczki', 'łyżeczek',
        'sztuk', 'sztuki', 'garść', 'garście',
        'opakowanie', 'opakowania', 'puszka', 'puszki',
        'szczypta', 'szczypty', 'plaster', 'plastry',
        'składniki', 'dodatki', 'topping', 'ciasto',
        'mokre', 'suche', 'do smaku', 'blaszkę',
    ];
    for (const p of garbagePatterns) {
        if (n === p || n.startsWith(p + ' ') || n.endsWith(' ' + p)) return true;
    }
    return false;
}

/** Normalizes name for comparison: lowercase, remove diacritics-ish */
function normalizeForMatch(name: string): string {
    return name.toLowerCase().trim()
        .replace(/ł/g, 'l').replace(/ą/g, 'a').replace(/ć/g, 'c')
        .replace(/ę/g, 'e').replace(/ń/g, 'n').replace(/ó/g, 'o')
        .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
        .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function makeSlug(name: string): string {
    return normalizeForMatch(name).replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ==================== MAIN SEEDER ====================

async function runSeeder() {
    const recipesDataPath = path.resolve(__dirname, '../data/recipes.json');
    if (!fs.existsSync(recipesDataPath)) {
        console.error('[SEEDER] No data/recipes.json found. Run fix_parsing.py first.');
        return;
    }

    if (!STRAPI_URL || !STRAPI_TOKEN) {
        console.error('[SEEDER] Missing STRAPI_URL or STRAPI_API_TOKEN in .env');
        return;
    }

    const recipesJson = JSON.parse(fs.readFileSync(recipesDataPath, 'utf8'));
    console.log(`[SEEDER] Loaded ${recipesJson.length} recipes from JSON.`);

    // ---- Phase 1: Load existing ingredients from Strapi ----
    console.log('[SEEDER] Phase 1: Loading existing ingredients from /api/food-items...');
    const ingByNorm = new Map<string, any>(); // normalized name -> strapi object
    const ingBySlug = new Map<string, any>(); // slug -> strapi object

    let page = 1;
    while (true) {
        const res = await fetch(`${STRAPI_URL}/api/food-items?pagination[page]=${page}&pagination[pageSize]=100`, { headers });
        const json: any = await res.json();
        if (!json.data || json.data.length === 0) break;
        for (const item of json.data) {
            ingByNorm.set(normalizeForMatch(item.name), item);
            if (item.slug) ingBySlug.set(item.slug.toLowerCase(), item);
        }
        page++;
    }
    console.log(`[SEEDER] Found ${ingByNorm.size} existing ingredients.`);

    // ---- Phase 2: Discover and create missing ingredients ----
    console.log('[SEEDER] Phase 2: Resolving ingredients...');
    const createdNames = new Set<string>();
    let createdCount = 0;
    let skippedGarbage = 0;

    for (const recipe of recipesJson) {
        for (const ing of recipe.ingredients) {
            const cleanName = cleanIngredientName(ing.name);
            const norm = normalizeForMatch(cleanName);
            const slug = makeSlug(cleanName);
            
            // Already in catalog or already created this run
            if (ingByNorm.has(norm) || ingBySlug.has(slug) || createdNames.has(norm)) continue;
            
            // Garbage check (AFTER cleaning)
            if (isGarbage(cleanName)) {
                skippedGarbage++;
                continue;
            }

            // Create new ingredient
            console.log(`[SEEDER] Creating: "${cleanName}"`);
            const createRes = await fetch(`${STRAPI_URL}/api/food-items`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    data: {
                        name: cleanName,
                        slug,
                        category: 'inne',
                        unitType: (ing.unit === 'szt' || ing.unit === 'opakowanie') ? 'piece' : 'weight',
                        kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
                    }
                })
            });
            const createJson: any = await createRes.json();
            if (createJson.data) {
                ingByNorm.set(norm, createJson.data);
                ingBySlug.set(slug, createJson.data);
                createdNames.add(norm);
                createdCount++;
            } else if (createJson.error) {
                console.warn(`[SEEDER] Failed to create "${cleanName}": ${createJson.error.message}`);
            }
        }
    }
    console.log(`[SEEDER] Phase 2 done. Created: ${createdCount}, Skipped garbage: ${skippedGarbage}`);

    // ---- Phase 3: Clear existing recipes ----
    console.log('[SEEDER] Phase 3: Clearing existing recipes...');
    while (true) {
        const res = await fetch(`${STRAPI_URL}/api/recipes?pagination[pageSize]=100`, { headers });
        const json: any = await res.json();
        if (!json.data || json.data.length === 0) break;
        for (const item of json.data) {
            await fetch(`${STRAPI_URL}/api/recipes/${item.documentId}`, { method: 'DELETE', headers });
        }
    }

    // ---- Phase 4: Import recipes ----
    console.log('[SEEDER] Phase 4: Importing recipes...');
    let imported = 0;
    let failed = 0;

    for (const recipeData of recipesJson) {
        const recipeName = (recipeData.name || '').replace(/\n/g, '').trim();
        
        // Map ingredients to component format
        const components = recipeData.ingredients.map((ing: any) => {
            const cleanName = cleanIngredientName(ing.name);
            const norm = normalizeForMatch(cleanName);
            const slug = makeSlug(cleanName);
            const found = ingByNorm.get(norm) || ingBySlug.get(slug);
            
            return {
                __component: 'shared.ingredient',
                name: cleanName,
                slug,
                ingredient: found?.documentId || found?.id || null,
                amount: ing.amount || 0,
                unit: ing.unit || 'g',
                weight: ing.weight || 0,
            };
        }).filter((c: any) => c.name && c.name.length >= 2);

        if (components.length === 0) {
            console.log(`[SEEDER] Skipping "${recipeName}" - no valid ingredients`);
            continue;
        }

        try {
            const createRes = await fetch(`${STRAPI_URL}/api/recipes`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    data: {
                        name: recipeName,
                        description: recipeData.description || '',
                        preparation: recipeData.preparation || '',
                        prepTime: recipeData.prepTime || 0,
                        servings: recipeData.servings || 1,
                        mealSlots: recipeData.mealSlot || [],
                        ingredients: components,
                        kcal: 0,
                        macros: { protein: 0, carbs: 0, fat: 0, fiber: 0 },
                        tags: Array.isArray(recipeData.tags) ? recipeData.tags.join(', ') : '',
                    }
                })
            });
            const json: any = await createRes.json();
            if (json.data?.documentId) {
                // Publish the recipe
                await fetch(`${STRAPI_URL}/api/recipes/${json.data.documentId}/actions/publish`, {
                    method: 'POST', headers
                });
                imported++;
                if (imported % 20 === 0) {
                    console.log(`[SEEDER] Progress: ${imported} recipes imported...`);
                }
            } else {
                console.warn(`[SEEDER] Failed "${recipeName}": ${json.error?.message || 'unknown'}`);
                failed++;
            }
        } catch (e: any) {
            console.error(`[SEEDER] Error "${recipeName}": ${e.message}`);
            failed++;
        }
    }

    console.log(`[SEEDER] DONE. Imported: ${imported}, Failed: ${failed}, Total ingredients: ${ingByNorm.size}`);
}

runSeeder().catch(console.error);
