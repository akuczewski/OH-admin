
export default ({ strapi }: { strapi: any }) => {
    console.log('[PLUGIN SERVER] Registering ingredient-lookup custom fields...');

    // Use strictly the singular name matching the schema and admin registration
    strapi.customFields.register({
        name: 'ingredient',
        pluginId: 'ingredient-lookup',
        type: 'string',
    });

    console.log('[PLUGIN SERVER] Custom fields registered.');
};
