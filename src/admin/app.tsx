import Logo from './extensions/logo.png';

export default {
    config: {
        locales: ['pl'],
        auth: {
            logo: Logo,
        },
        menu: {
            logo: Logo,
        },
        head: {
            favicon: Logo,
        },
    },
    register(app: any) {
        // Legacy custom fields have been migrated to the ingredient-lookup plugin.
    },
    bootstrap(app: any) {
        // App bootstrap logic
    },
};
