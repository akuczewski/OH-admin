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
                    auth: false,
                },
            },
            {
                method: 'POST',
                path: '/calculate-macros',
                handler: 'ingredient.calculateMacros',
                config: {
                    policies: [],
                    auth: false,
                },
            },
            {
                method: 'POST',
                path: '/import-url',
                handler: 'recipeImport.importUrl',
                config: {
                    policies: [],
                    auth: false,
                },
            },
        ],
    },
};
