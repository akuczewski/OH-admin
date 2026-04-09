
export default {
    routes: [
        {
            method: 'GET',
            path: '/ingredients/search',
            handler: 'ingredient.search',
            config: {
                auth: false, // For now, we'll keep it open for testing, or use API tokens later
            },
        },
        {
            method: 'POST',
            path: '/ingredients/calculate-macros',
            handler: 'ingredient.calculateMacros',
            config: {
                auth: false,
            },
        },
    ],
};
