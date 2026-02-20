
import { Search } from '@strapi/icons';
// @ts-ignore
import { Input as IngredientLookup } from './components/IngredientLookup';

export default {
    config: {
        locales: ['pl'],
    },
    register(app: any) {
        console.log('[GLOBAL] Registering ingredient-lookup custom fields (V5 Named Export mode)...');

        const fieldBase = {
            pluginId: 'ingredient-lookup',
            type: 'string',
            intlLabel: {
                id: 'ingredient-lookup.label',
                defaultMessage: 'Ingredient Lookup',
            },
            intlDescription: {
                id: 'ingredient-lookup.description',
                defaultMessage: 'Search and select an ingredient',
            },
            icon: Search,
            components: {
                Input: async () => {
                    console.log('[GLOBAL] Loading custom field component (Input)...');
                    return IngredientLookup;
                },
            },
        };

        // Register multiple variants to definitively find the right one
        try {
            app.customFields.register({
                ...fieldBase,
                name: 'ingredient-lookup',
            });
            app.customFields.register({
                ...fieldBase,
                name: 'ingredient',
            });
            console.log('[GLOBAL] Custom fields registered: ingredient, ingredient-lookup');
        } catch (err) {
            console.error('[GLOBAL] Registration error:', err);
        }
    },
    bootstrap(app: any) {
        console.log('[GLOBAL] Admin Bootstrap');
    },
};
