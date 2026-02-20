
import { Search } from '@strapi/icons';
// @ts-ignore
import { Input as IngredientLookup } from './components/IngredientLookup';

export default {
    config: {
        locales: ['pl'],
    },
    register(app: any) {
        console.log('!!! GLOBAL REGISTER START !!!');

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
                Input: async () => {
                    console.log('!!! LOADING CUSTOM FIELD COMPONENT (GLOBAL) !!!');
                    return IngredientLookup;
                },
            },
        };

        try {
            // Register both possible identifiers used in schema
            app.customFields.register({
                ...fieldBase,
                name: 'ingredient',
            });
            console.log('!!! REGISTERED: plugin::ingredient-lookup.ingredient !!!');

            app.customFields.register({
                ...fieldBase,
                name: 'ingredient-lookup',
            });
            console.log('!!! REGISTERED: plugin::ingredient-lookup.ingredient-lookup !!!');

        } catch (err) {
            console.error('!!! GLOBAL REGISTER ERROR !!!', err);
        }
    },
    bootstrap(app: any) {
        console.log('!!! GLOBAL BOOTSTRAP !!!');
    },
};
