import type { Core } from '@strapi/strapi';
import admin from 'firebase-admin';
import { db } from './lib/firebase';

const collectionsToSync = {
  'api::recipe.recipe': 'recipes',
  'api::ingredient-catalog.ingredient-catalog': 'ingredients',
  'api::motivation-quote.motivation-quote': 'quotes',
  'api::profile.profile': 'profiles',
};

async function calculateRecipeMacros(recipe: any, strapi: Core.Strapi) {
  if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) return null;

  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;

  for (const ingComponent of recipe.ingredients) {
    if (!ingComponent.ingredient) continue;
    
    try {
      // @ts-ignore
      const ingDoc = await strapi.documents('api::ingredient-catalog.ingredient-catalog').findOne({
        documentId: ingComponent.ingredient.documentId || ingComponent.ingredient,
      });

      if (ingDoc) {
        const amount = ingComponent.amount || 0;
        const multiplier = amount / 100; // Assuming kcal/100g

        totalKcal += (ingDoc.kcal || 0) * multiplier;
        totalProtein += (ingDoc.protein || 0) * multiplier;
        totalCarbs += (ingDoc.carbs || 0) * multiplier;
        totalFat += (ingDoc.fat || 0) * multiplier;
        totalFiber += (ingDoc.fiber || 0) * multiplier;
      }
    } catch (err) {
      console.error('[MACROS] Failed to fetch ingredient for calculation:', err);
    }
  }

  return {
    kcal: Math.round(totalKcal),
    protein: Math.round(totalProtein * 10) / 10,
    carbs: Math.round(totalCarbs * 10) / 10,
    fat: Math.round(totalFat * 10) / 10,
    fiber: Math.round(totalFiber * 10) / 10,
  };
}

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    // Register custom fields
    strapi.customFields.register({
      name: 'ingredient-lookup',
      // @ts-ignore
      plugin: 'ingredient-lookup',
      type: 'string',
    });

    // --- Middleware: Automatic Macro Calculation & Firebase Sync ---
    strapi.documents.use(async (context, next) => {
      const { uid, action, params } = context;
      const collectionName = collectionsToSync[uid as keyof typeof collectionsToSync];

      // 1. Intercept Recipe Create/Update to calculate macros
      if (uid === 'api::recipe.recipe' && ['create', 'update'].includes(action)) {
        console.log(`[MACROS] Calculating for recipe: ${params.data?.name}`);
        const macros = await calculateRecipeMacros(params.data, strapi);
        if (macros) {
          params.data.kcal = macros.kcal;
          params.data.macros = {
            protein: macros.protein,
            carbs: macros.carbs,
            fat: macros.fat,
            fiber: macros.fiber,
          };
        }
      }

      const result = await next();

      // 2. Post-action Firebase Sync (Background)
      if (collectionName && ['create', 'update', 'delete', 'publish', 'unpublish'].includes(action)) {
        (async () => {
          try {
            console.log(`[FIREBASE] Syncing ${uid} to ${collectionName}...`);
            const docId = result.documentId;
            if (action === 'delete') {
              await db.collection(collectionName).doc(docId).delete();
            } else {
              // Fetch full document with relations if needed
              // @ts-ignore
              const fullDoc = await strapi.documents(uid).findOne({ documentId: docId });
              await db.collection(collectionName).doc(docId).set(fullDoc, { merge: true });
            }
          } catch (error: any) {
            console.error(`[FIREBASE] Sync failed for ${uid}:`, error.message);
          }
        })();
      }

      return result;
    });
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    console.log('--- RECOVERY BOOTSTRAP: Ingredient Catalog Instance ---');
  },
};
