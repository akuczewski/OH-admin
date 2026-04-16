export default {
    admin: {
        type: 'admin',
        routes: [
            {
                method: 'GET',
                path: '/search',
                handler: 'ingredient.search',
                config: {
                    policies: [],
                },
            },
            {
                method: 'POST',
                path: '/calculate-macros',
                handler: 'ingredient.calculateMacros',
                config: {
                    policies: [],
                },
            },
            {
                method: 'POST',
                path: '/import-url',
                handler: 'recipeImport.importUrl',
                config: {
                    policies: [],
                },
            },
        ],
    },
};
