
import { Search } from '@strapi/icons';
// @ts-ignore
import { Input as IngredientSearch } from './components/IngredientSearch';

export default {
    config: {
        locales: ['pl'],
    },
    register(app: any) {
        console.log('[IngredientLookup] Registering custom field...');

        const fieldBase = {
            pluginId: 'ingredient-lookup',
            type: 'string',
            intlLabel: {
                id: 'ingredient-lookup.label',
                defaultMessage: 'Ingredient Lookup',
            },
            intlDescription: {
                id: 'ingredient-lookup.description',
                defaultMessage: 'Search and select an ingredient from Firebase',
            },
            icon: Search,
            components: {
                // The wrapper that fixed the "Unsupported field type" error in Strapi 5
                Input: async () => ({ default: IngredientSearch }),
            },
        };

        try {
            // Register both variants for absolute robustness
            app.customFields.register({
                ...fieldBase,
                name: 'ingredient',
            });
            app.customFields.register({
                ...fieldBase,
                name: 'ingredient-lookup',
            });
            console.log('[IngredientLookup] Registration successful.');
        } catch (err) {
            console.error('[IngredientLookup] Registration error:', err);
        }
    },
    bootstrap(app: any) {
        // App bootstrap logic
    },
};
