
import type { StrapiApp } from '@strapi/strapi/admin';

export default {
    config: {
        locales: ['pl'],
    },
    bootstrap(app: StrapiApp) {
        console.log('[APP] Strapi Admin Bootstrap');
    },
};
