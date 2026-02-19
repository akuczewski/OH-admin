import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
    'export-import-clsx': {
        enabled: true,
    },
    'ingredient-lookup': {
        enabled: true,
        resolve: './src/plugins/ingredient-lookup'
    },
});

export default config;
