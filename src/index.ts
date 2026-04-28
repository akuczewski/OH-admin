import type { Core } from '@strapi/strapi';
import { db } from './lib/firebase';

/*
  OH! Admin - Core Logic
  
  Note on Seeding: 
  Automatic seeding in bootstrap() is DISABLED to prevent overwriting manual expert changes.
  Always manage production data via Strapi Admin UI or dedicated maintenance scripts.
*/

export default {
  register({ strapi }: { strapi: Core.Strapi }) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    console.log('--- [OH! ADMIN] Bootstrap initializing... ---');
    console.log('--- [MASTER SEEDER] Internal recovery is DISABLED (Manual management only) ---');

    // ==================== PERMISSION GUARD ====================
    try {
      console.log('--- [PERMISSION GUARD] Ensuring public access to ingredients search... ---');
      const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
        where: { type: 'public' }
      });
      
      if (publicRole) {
        const targetAction = 'api::skladnik.skladnik.find';
        const existingPermission = await strapi.query('plugin::users-permissions.permission').findOne({
          where: {
            role: publicRole.id,
            action: targetAction
          }
        });

        if (!existingPermission) {
          await strapi.query('plugin::users-permissions.permission').create({
            data: {
              action: targetAction,
              role: publicRole.id
            }
          });
          console.log(`[PERMISSION GUARD] Granted ${targetAction} permission to Public role.`);
        } else {
          console.log(`[PERMISSION GUARD] Permission ${targetAction} already exists.`);
        }
      }
    } catch (err: any) {
      console.error('[PERMISSION GUARD ERROR]', err.message);
    }
  },
};
