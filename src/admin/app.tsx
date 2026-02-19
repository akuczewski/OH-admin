
import { Search } from '@strapi/icons';
// @ts-ignore
import IngredientLookup from '../plugins/ingredient-lookup/admin/src/components/IngredientLookup/index';

export default {
    config: {
        locales: ['pl'],
    },
    register(app: any) {
        console.log('[APP] Registering global ingredient-lookup custom field (register phase)...');

        try {
            app.customFields.register({
                name: 'ingredient-lookup',
                pluginId: 'ingredient-lookup',
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
            console.log('[APP] Custom field registered successfully.');
        } catch (err) {
            console.error('[APP] Failed to register custom field:', err);
        }
    },
    bootstrap(app: any) {
        console.log('[APP] Bootstrap phase');
    },
};
