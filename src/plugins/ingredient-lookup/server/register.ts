
export default ({ strapi }) => {
    strapi.customFields.register({
        name: 'ingredient-lookup',
        plugin: 'ingredient-lookup',
        type: 'string',
    });
};
