export default ({ strapi }: { strapi: any }) => ({
    async importUrl(ctx: any) {
        const { url } = ctx.request.body;

        if (!url) {
            return ctx.badRequest('URL is required');
        }

        try {
            const result = await strapi
                .plugin('ingredient-lookup')
                .service('recipeImport')
                .importFromUrl(url);

            ctx.body = {
                data: result,
                message: 'Recipe imported successfully as draft'
            };
        } catch (error: any) {
            console.error('[PLUGIN-CONTROLLER] Import error:', error);
            ctx.internalServerError('Failed to import recipe: ' + error.message);
        }
    },
});
