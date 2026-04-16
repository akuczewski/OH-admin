import { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
    async search(ctx) {
        try {
            const { q } = ctx.query;
            if (!q || typeof q !== 'string') {
                return ctx.badRequest('Query parameter q is required');
            }

            const results = await strapi
                .plugin('ingredient-lookup')
                .service('ingredient')
                .search(q);

            ctx.body = results;
        } catch (err: any) {
            ctx.throw(500, err.message);
        }
    },

    async calculateMacros(ctx) {
        try {
            const { ingredients } = ctx.request.body;
            if (!ingredients) {
                return ctx.badRequest('Ingredients are required');
            }

            const result = await strapi
                .plugin('ingredient-lookup')
                .service('ingredient')
                .calculateMacros(ingredients);

            ctx.body = result;
        } catch (err: any) {
            ctx.throw(500, err.message);
        }
    },
});
