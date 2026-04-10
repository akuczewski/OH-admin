import type { Core } from '@strapi/strapi';

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    // Basic registration for custom fields if needed
    strapi.customFields.register({
      name: 'ingredient-lookup',
      // @ts-ignore
      plugin: 'ingredient-lookup',
      type: 'string',
    });
  },

  async bootstrap() {
    console.log('--- EMERGENCY BOOTSTRAP: ALL HOOKS DISABLED ---');
    // Disable all background tasks to unblock API
  },
};
