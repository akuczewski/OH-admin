
export default ({ strapi }) => {
    console.log('[PLUGIN SERVER] Registering ingredient-lookup custom field...');
    strapi.customFields.register({
        name: 'ingredient-lookup',
        pluginId: 'ingredient-lookup',
        type: 'string',
    });
    console.log('[PLUGIN SERVER] ingredient-lookup custom field registered.');
};
