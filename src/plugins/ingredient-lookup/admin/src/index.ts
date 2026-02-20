import { Search } from '@strapi/icons';
// @ts-ignore
import { Input } from './components/IngredientLookup';
// @ts-ignore
import RecalculateButton from './components/RecalculateButton';

export default {
    register(app: any) {
        console.log('[PLUGIN-INGREDIENT] Registering custom field...');

        // Hard marker to prove code execution in the browser
        if (typeof window !== 'undefined') {
            (window as any).INGREDIENT_LOOKUP_LOADED = true;
            // Un-comment the line below if you want a visual pop-up to be 100% sure
            // alert('Ingredient Plugin Registered'); 
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

        app.customFields.register({
            name: 'calculator',
            pluginId: 'ingredient-lookup',
            type: 'boolean',
            intlLabel: {
                id: 'ingredient-lookup.calculator.label',
                defaultMessage: 'Macro Calculator Button',
            },
            intlDescription: {
                id: 'ingredient-lookup.calculator.description',
                defaultMessage: 'Button to recalculate macros from Firebase',
            },
            icon: Search,
            components: {
                Input: async () => RecalculateButton,
            },
        });

        console.log('[PLUGIN-INGREDIENT] Custom fields registered.');
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
