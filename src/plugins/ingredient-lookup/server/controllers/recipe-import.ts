import { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
    async importUrl(ctx) {
        try {
            const { url } = ctx.request.body;

            if (!url) {
                return ctx.badRequest('Adres URL jest wymagany');
            }

            // Verify if it's a valid URL string
            if (typeof url !== 'string' || !url.startsWith('http')) {
                return ctx.badRequest('Nieprawidłowy adres URL');
            }

            console.log('[RECIPE-IMPORTER] Controller received URL import request:', url);

            // Call the service created in services/recipe-import.ts
            const result = await strapi
                .plugin('ingredient-lookup')
                .service('recipeImport')
                .fetchAndParseRecipe(url);

            ctx.body = result;
        } catch (err: any) {
            console.error('[RECIPE-IMPORTER] Controller Error:', err.message);
            ctx.throw(500, err.message || 'Błąd podczas importowania przepisu z URL');
        }
    },
});
