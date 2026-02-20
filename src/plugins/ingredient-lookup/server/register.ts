
export default ({ strapi }: { strapi: any }) => {
    console.log('[PLUGIN SERVER] Registering ingredient-lookup custom fields...');

    // Register both to be safe and match admin-side
    strapi.customFields.register({
        name: 'ingredient-lookup',
        pluginId: 'ingredient-lookup',
        type: 'string',
    });

    strapi.customFields.register({
        name: 'ingredient',
        pluginId: 'ingredient-lookup',
        type: 'string',
    });

    console.log('[PLUGIN SERVER] Custom fields (ingredient, ingredient-lookup) registered.');
};
