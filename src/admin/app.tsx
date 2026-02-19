
import { Search } from '@strapi/icons';
// @ts-ignore
import IngredientLookup from 'ingredient-lookup/strapi-admin';

export default {
    config: {
        locales: ['pl'],
    },
    register(app: any) {
        console.log('[APP] Registering global ingredient-lookup custom field...');

        app.customFields.register({
            name: 'ingredient-lookup',
            pluginId: 'ingredient-lookup', // Hardcoded pluginId to match usage in schema
            type: 'string',
            intlLabel: {
                id: 'ingredient-lookup.label',
                defaultMessage: 'Ingredient Lookup (Firebase)',
            },
            intlDescription: {
                id: 'ingredient-lookup.description',
                defaultMessage: 'Search and select an ingredient from the global database',
            },
            icon: Search,
            components: {
                Input: async () => IngredientLookup,
            },
        });

        console.log('[APP] Global custom field registered.');
    },
    bootstrap(app: any) {
        // ...
    },
};
