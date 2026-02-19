
import { prefixPluginTranslations } from '@strapi/helper-plugin';
import IngredientLookupIcon from './components/IngredientLookupIcon';
import pluginId from './pluginId';

export default {
    register(app) {
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

    async registerTrads({ locales }) {
        const importedTrads = await Promise.all(
            locales.map((locale) => {
                return import(`./translations/${locale}.json`)
                    .then(({ default: data }) => {
                        return {
                            data: prefixPluginTranslations(data, pluginId),
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
