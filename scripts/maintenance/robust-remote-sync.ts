import 'dotenv/config';

/**
 * robust-remote-sync.ts
 * 
 * Advanced migration script to fix ingredient relations on remote Strapi.
 */

const STRAPI_URL = 'https://useful-sparkle-79935e08b6.strapiapp.com';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN?.trim().replace(/^"|"$/g, '');

async function runSync() {
    if (!STRAPI_TOKEN) {
        console.error('Missing STRAPI_API_TOKEN in .env');
        return;
    }

    console.log(`[ROBUST-SYNC] Initializing...`);

    console.log(`[ROBUST-SYNC] Loading ingredients catalog from ${STRAPI_URL}/api/ingredients...`);
    const ingRes = await fetch(`${STRAPI_URL}/api/ingredients?pagination[pageSize]=1000`, {
        headers: { 'Authorization': `Bearer ${STRAPI_TOKEN}` }
    });
    
    if (!ingRes.ok) {
        console.error(`[ROBUST-SYNC] Catalog fetch failed: ${ingRes.status} ${ingRes.statusText}`);
        const text = await ingRes.text();
        console.error(`[ROBUST-SYNC] Response body: ${text.substring(0, 200)}`);
        return;
    }

    const ingJson = await ingRes.json();
    if (!ingJson.data) {
        console.error(`[ROBUST-SYNC] Unexpected response format:`, JSON.stringify(ingJson).substring(0, 200));
        return;
    }

    const ingMap = new Map();
    ingJson.data.forEach((i: any) => {
        ingMap.set(i.name.toLowerCase().trim(), i.documentId);
        if (i.slug) ingMap.set(i.slug.toLowerCase().trim(), i.documentId);
    });
    console.log(`[ROBUST-SYNC] Catalog loaded: ${ingMap.size} unique ingredients.`);

    // 2. Fetch and update Recipes
    let page = 1;
    let totalUpdated = 0;
    let hasMore = true;

    while (hasMore) {
        const res = await fetch(`${STRAPI_URL}/api/recipes?populate=ingredients&pagination[page]=${page}&pagination[pageSize]=50`, {
            headers: { 'Authorization': `Bearer ${STRAPI_TOKEN}` }
        });

        const json = await res.json();
        const recipes = json.data;

        if (!recipes || recipes.length === 0) break;

        console.log(`[ROBUST-SYNC] Processing page ${page} (${recipes.length} recipes)...`);

        for (const recipe of recipes) {
            const documentId = recipe.documentId;
            const ingredients = recipe.ingredients || [];
            
            let needsUpdate = false;
            const newIngredientComponents = [];
            const usedIngredientIds = new Set<string>();

            for (const comp of ingredients) {
                const name = comp.name.toLowerCase().trim();
                const targetId = ingMap.get(name);
                
                if (targetId) {
                    usedIngredientIds.add(targetId);
                    newIngredientComponents.push({
                        ...comp,
                        ingredient: targetId // Assign the official ID
                    });
                    needsUpdate = true;
                } else {
                    newIngredientComponents.push(comp);
                }
            }

            if (needsUpdate) {
                const updateRes = await fetch(`${STRAPI_URL}/api/recipes/${documentId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${STRAPI_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        data: {
                            ingredients: newIngredientComponents,
                            used_ingredients: Array.from(usedIngredientIds)
                        }
                    })
                });

                if (updateRes.ok) {
                    console.log(`[ROBUST-SYNC] Fixed relations for: "${recipe.name}" (${usedIngredientIds.size} links)`);
                    totalUpdated++;
                } else {
                    console.error(`[ROBUST-SYNC] Failed updating "${recipe.name}": ${updateRes.status}`);
                }
            }
        }

        page++;
        if (page > json.meta.pagination.pageCount) hasMore = false;
    }

    console.log(`[ROBUST-SYNC] FINISHED. Successfully updated relations for ${totalUpdated} recipes.`);
}

runSync().catch(console.error);
