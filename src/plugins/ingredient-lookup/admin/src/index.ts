
import IngredientLookupIcon from './components/IngredientLookupIcon';

export default {
    register(app: any) {
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
            icon: IngredientLookupIcon,
            components: {
                Input: async () => import('./components/IngredientLookup'),
            },
            options: {
                // No extra options for now
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
