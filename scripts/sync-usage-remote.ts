import 'dotenv/config';

/**
 * sync-usage-remote.ts
 * 
 * Migration script using the REST API to synchronize ingredient usage.
 * This works directly on the remote Strapi server.
 */

const STRAPI_URL = 'https://useful-sparkle-79935e08b6.strapiapp.com';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN?.trim().replace(/^"|"$/g, '');

async function runSync() {
    if (!STRAPI_TOKEN) {
        console.error('Missing STRAPI_API_TOKEN in .env');
        return;
    }

    console.log(`[REMOTE-SYNC] Fetching recipes from ${STRAPI_URL}...`);
    
    // 1. Fetch all recipes
    let page = 1;
    let totalProcessed = 0;
    let hasMore = true;

    while (hasMore) {
        const res = await fetch(`${STRAPI_URL}/api/recipes?populate=ingredients&pagination[page]=${page}&pagination[pageSize]=100`, {
            headers: { 'Authorization': `Bearer ${STRAPI_TOKEN}` }
        });

        if (!res.ok) {
            console.error(`Failed to fetch recipes: ${res.statusText}`);
            break;
        }

        const json = await res.json();
        const recipes = json.data;

        if (!recipes || recipes.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`[REMOTE-SYNC] Processing page ${page} (${recipes.length} recipes)...`);

        for (const recipe of recipes) {
            const documentId = recipe.documentId;
            const ingredients = recipe.ingredients || [];
            
            // Extract ingredient IDs from the component
            // In Strapi 5 REST-populate, 'ingredient' field might be a nested object or a documentId
            const ingredientIds = ingredients
                .map((ing: any) => ing.ingredient || ing.documentId)
                .filter(Boolean);

            if (ingredientIds.length > 0) {
                // Update the recipe with the new relationship
                const updateRes = await fetch(`${STRAPI_URL}/api/recipes/${documentId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${STRAPI_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        data: {
                            used_ingredients: ingredientIds
                        }
                    })
                });

                if (updateRes.ok) {
                    console.log(`[REMOTE-SYNC] Updated: "${recipe.name}" with ${ingredientIds.length} ingredients.`);
                    totalProcessed++;
                } else {
                    console.warn(`[REMOTE-SYNC] Failed to update "${recipe.name}": ${updateRes.statusText}`);
                }
            }
        }

        page++;
        if (page > json.meta.pagination.pageCount) hasMore = false;
    }

    console.log(`[REMOTE-SYNC] FINISHED. Processed total of ${totalProcessed} recipes.`);
}

runSync().catch(console.error);
