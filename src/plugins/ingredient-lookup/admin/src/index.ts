import { Search } from '@strapi/icons';
// @ts-ignore
import Input from './components/IngredientLookup';
import RecipeImporterButton from './components/RecipeImporterButton';

export default {
    register(app: any) {
        console.log('--- [INGREDIENT-PLUGIN V5.2 - STABILITY] REGISTERING ---');

        // Hard marker to prove code execution in the browser
        if (typeof window !== 'undefined') {
            (window as any).INGREDIENT_LOOKUP_LOADED = true;
            console.log('[INGREDIENT-PLUGIN V5.2 - STABILITY] Window marker set.');
        }

        app.customFields.register({
            name: 'ingredient', // Singular name matching the error
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
                Input: async () => Input,
            },
        });

        app.registerPlugin({
            id: 'ingredient-lookup',
            name: 'ingredient-lookup',
        });

    },

    bootstrap(app: any) {
        app.getPlugin('content-manager').injectComponent('editView', 'right-links', {
            name: 'RecipeImporterButton',
            Component: RecipeImporterButton,
        });
    },

    async registerTrads({ locales }: { locales: string[] }) {
        const importedTrads = await Promise.all(
            locales.map((locale: string) => {
                return import(`./translations/${locale}.json`)
                    .then(({ default: data }) => {
                        return {
                            data,
                            locale,
                        };
                    })
                    .catch(() => {
                        return {
                            data: {},
                            locale,
                        };
                    });
            })
        );

        return Promise.resolve(importedTrads);
    },
};
