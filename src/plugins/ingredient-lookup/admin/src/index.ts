import IngredientLookup from './components/IngredientLookup';
import IngredientLookupIcon from './components/IngredientLookupIcon';
import pluginId from './pluginId';

export default {
    register(app: any) {
        app.customFields.register({
            name: 'ingredient-lookup',
            pluginId: pluginId,
            type: 'string',
            intlLabel: {
                id: `${pluginId}.label`,
                defaultMessage: 'Ingredient Lookup (Firebase)',
            },
            intlDescription: {
                id: `${pluginId}.description`,
                defaultMessage: 'Search and select an ingredient from the global database',
            },
            icon: IngredientLookupIcon,
            components: {
                Input: async () => IngredientLookup,
            },
        });

        app.addMenuLink({
            to: `/plugins/${pluginId}`,
            icon: IngredientLookupIcon,
            intlLabel: {
                id: `${pluginId}.menu.label`,
                defaultMessage: 'Smart Import',
            },
            Component: async () => {
                const { default: HomePage } = await import('./pages/HomePage');
                return HomePage;
            },
        });
    },

    async registerTrads({ locales }: { locales: string[] }) {
        const importedTrads = await Promise.all(
            locales.map((locale: string) => {
                return import(`./translations/${locale}.json`)
                    .then(({ default: data }) => {
                        return {
                            data, // In Strapi 5, prefixing is handled differently or data can be returned directly
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
