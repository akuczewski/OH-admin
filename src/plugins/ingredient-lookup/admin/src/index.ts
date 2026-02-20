
import { Search } from '@strapi/icons';
// @ts-ignore
import IngredientLookup from './components/IngredientLookup';

export default {
    register(app: any) {
        console.log('[PLUGIN] Registering ingredient-lookup plugin custom fields...');

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
                Input: async () => IngredientLookup,
            },
        };

        // Register both to be safe
        app.customFields.register({
            ...fieldBase,
            name: 'ingredient-lookup',
        });

        app.customFields.register({
            ...fieldBase,
            name: 'ingredient',
        });

        app.addMenuLink({
            to: `/plugins/ingredient-lookup`,
            icon: Search,
            intlLabel: {
                id: 'ingredient-lookup.menu.label',
                defaultMessage: 'Smart Import',
            },
            Component: async () => {
                const { default: HomePage } = await import('./pages/HomePage');
                return HomePage;
            },
        });

        console.log('[PLUGIN] Custom fields (ingredient, ingredient-lookup) registered successfully.');
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
