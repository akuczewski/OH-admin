
export default [
    {
        method: 'POST',
        path: '/import-url',
        handler: 'recipeImport.importUrl',
        config: {
            policies: [],
            auth: false, // For simplicity now, in production we should use Strapi admin auth
        },
    },
];
