import 'dotenv/config';
import { createStrapi } from '@strapi/strapi';

/**
 * sync-usage.ts
 * 
 * One-off migration script to populate the 'used_ingredients' relation 
 * based on the 'ingredients' component in all recipes.
 */

async function main() {
    console.log('[SYNC] Initializing Strapi...');
    const strapi = await createStrapi({ appDir: process.cwd() }).load();

    try {
        console.log('[SYNC] Fetching recipes...');
        const recipes = await strapi.documents('api::recipe.recipe' as any).findMany({
            populate: ['ingredients'],
            limit: -1
        });

        console.log(`[SYNC] Found ${recipes.length} recipes to process.`);

        let count = 0;
        for (const recipe of recipes as any[]) {
            if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) continue;

            const ingredientIds = recipe.ingredients
                .map((ing: any) => ing.ingredient || ing.documentId)
                .filter(Boolean);

            if (ingredientIds.length > 0) {
                await strapi.documents('api::recipe.recipe' as any).update({
                    documentId: recipe.documentId,
                    data: {
                        used_ingredients: ingredientIds
                    },
                    status: 'published'
                });
                count++;
            }
        }

        console.log(`[SYNC] COMPLETED. Successfully synchronized ${count} recipes.`);
    } catch (err) {
        console.error('[SYNC] Error during migration:', err);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}

main().catch(err => {
    console.error('[SYNC] Startup error:', err);
    process.exit(1);
});
