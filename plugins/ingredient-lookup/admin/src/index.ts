import { Search } from '@strapi/icons';
// @ts-ignore

export default {
    register(app: any) {
        console.log('[PLUGIN] Registering ingredient-lookup...');

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
                Input: async () => import('./components/IngredientLookup'),
            },
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

        console.log('[PLUGIN] ingredient-lookup registered successfully.');
    },

    async registerTrads({ locales }: { locales: string[] }) {
        console.log('[PLUGIN] Registering translations for:', locales);
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
