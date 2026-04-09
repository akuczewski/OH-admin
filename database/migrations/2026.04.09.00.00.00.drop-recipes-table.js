'use strict';

/**
 * Migration to drop the recipes table.
 * This is necessary because changing the "meal_slot" column from 
 * Enumeration (varchar) to JSON (jsonb) fails due to invalid cast syntax.
 * Since we are doing a full recipe wipe for Task 2, dropping the table 
 * is the cleanest way to let Strapi recreate it with the new schema.
 */

module.exports = {
  async up(knex) {
    const hasTable = await knex.schema.hasTable('recipes');
    if (hasTable) {
      console.log('[MIGRATION] Dropping table "recipes" to resolve JSON conversion conflict...');
      await knex.schema.dropTable('recipes');
    }
  },

  async down(knex) {
    // No rollback needed for this wipe
  },
};
