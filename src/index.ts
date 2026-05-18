import type { Core } from '@strapi/strapi';
import { db } from './lib/firebase';

const collectionsToSync = {
  'api::recipe.recipe': 'recipes',
  'api::skladnik.skladnik': 'ingredients',
  'api::motivation-quote.motivation-quote': 'quotes',
  'api::profile.profile': 'profiles',
  'api::article.article': 'articles',
  'api::skin-care.skin-care': 'skincare',
  'api::training.training': 'training',
  'api::habit.habit': 'habits',
};

// ==================== MACRO CALCULATOR ====================

// Mirrors src/lib/nutrition.ts UNIT_CONVERSIONS — must stay in sync with app
const UNIT_CONVERSIONS: Record<string, number> = {
  'g': 1,
  'ml': 1,
  'lyzka': 15,
  'lyzeczka': 5,
  'szklanka': 250,
  'szczypta': 1,
  'garstka': 30,
  'plaster': 20,
};

async function calculateRecipeMacros(recipe: any, strapi: Core.Strapi, ingredientMap?: Map<string, any>) {
  if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) return null;

  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;

  for (const ingComponent of recipe.ingredients) {
    if (!ingComponent.ingredient) continue;
    
    let ingDoc: any = null;
    let lookupParams: any = null;

    const rawIng = ingComponent.ingredient;

    if (Array.isArray(rawIng) && rawIng.length > 0) {
      const first = rawIng[0];
      if (typeof first === 'string') lookupParams = { documentId: first };
      else if (typeof first === 'number') lookupParams = { id: first };
      else if (typeof first === 'object') lookupParams = { documentId: (first as any).documentId || (first as any).id };
    } else if (typeof rawIng === 'string') {
      lookupParams = { documentId: rawIng };
    } else if (typeof rawIng === 'number') {
      lookupParams = { id: rawIng };
    } else if (rawIng.documentId) {
      lookupParams = { documentId: rawIng.documentId };
    } else if (rawIng.id) {
      lookupParams = { id: rawIng.id };
    } else if (rawIng.connect && Array.isArray(rawIng.connect) && rawIng.connect.length > 0) {
      const conn = rawIng.connect[0];
      if (typeof conn === 'string') lookupParams = { documentId: conn };
      else if (typeof conn === 'number') lookupParams = { id: conn };
      else if (typeof conn === 'object') lookupParams = { documentId: conn.documentId || conn.id };
    }

    if (!lookupParams) continue;

    const cacheKey = lookupParams.documentId || lookupParams.id?.toString();

    if (ingredientMap && cacheKey && ingredientMap.has(cacheKey)) {
      ingDoc = ingredientMap.get(cacheKey);
    } else if (cacheKey) {
      try {
        // @ts-ignore
        ingDoc = await strapi.documents('api::skladnik.skladnik').findOne(lookupParams);
      } catch (err: any) {
        console.error(`[MACRO CALC] Error finding ingredient ${cacheKey}:`, err.message);
      }
    }

    if (ingDoc) {
      const amount = parseFloat(String(ingComponent.amount || '0').replace(',', '.')) || 0;
      const unit = (ingComponent.unit || 'g').toLowerCase();
      let factor = 0;

      if (ingComponent.weight && ingComponent.weight > 0) {
        factor = Number(ingComponent.weight) / 100;
      } else if (ingDoc.unitType === 'piece') {
        if (unit === 'szt' || unit === 'opakowanie') {
          factor = amount;
        } else if (UNIT_CONVERSIONS[unit]) {
          factor = (amount * UNIT_CONVERSIONS[unit]) / (Number(ingDoc.averagePieceWeight) || 100);
        } else {
          factor = amount;
        }
      } else {
        let weightInGrams = 0;
        if (UNIT_CONVERSIONS[unit]) {
          weightInGrams = amount * UNIT_CONVERSIONS[unit];
        } else if (unit === 'szt' || unit === 'opakowanie') {
          weightInGrams = amount * (Number(ingDoc.averagePieceWeight) || 100);
        } else {
          weightInGrams = amount;
        }
        factor = weightInGrams / 100;
      }

      totalKcal += (Number(ingDoc.kcal) || 0) * factor;
      totalProtein += (Number(ingDoc.protein) || 0) * factor;
      totalCarbs += (Number(ingDoc.carbs) || 0) * factor;
      totalFat += (Number(ingDoc.fat) || 0) * factor;
      totalFiber += (Number(ingDoc.fiber) || 0) * factor;
    }
  }

  return {
    kcal: Math.round(totalKcal),
    protein: Math.round(totalProtein),
    carbs: Math.round(totalCarbs),
    fat: Math.round(totalFat),
    fiber: Math.round(totalFiber),
  };
}

// ==================== IMAGE URL UTILS ====================

function normalizeImageUrl(image: any): string {
  const url = image?.url || (typeof image === 'string' ? image : '');
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const strapiUrl = (process.env.STRAPI_URL || process.env.URL || 'http://localhost:1337').replace(/\/$/, '');
  return `${strapiUrl}${url.startsWith('/') ? url : `/${url}`}`;
}

// ==================== STRAPI CONFIG ====================

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    strapi.customFields.register({
      name: 'ingredient-lookup',
      // @ts-ignore
      plugin: 'ingredient-lookup',
      type: 'string',
    });

    strapi.documents.use(async (context, next) => {
      const { uid, action, params } = context;
      const collectionName = collectionsToSync[uid as keyof typeof collectionsToSync];

      if (uid === 'api::recipe.recipe' && ['create', 'update'].includes(action)) {
        const data = (params as any).data;
        const isUpdate = action === 'update';
        const docId = (params as any).documentId || (params as any).id;
        
        let ingredientsForCalc = data.ingredients;
        let existingRecipe: any = null;

        if (isUpdate && docId) {
          try {
            existingRecipe = await (strapi.documents('api::recipe.recipe' as any) as any).findOne({
              documentId: docId,
              populate: { ingredients: { populate: { ingredient: true } } }
            });
          } catch (err: any) {}
        }

        if (ingredientsForCalc && Array.isArray(ingredientsForCalc)) {
          ingredientsForCalc = ingredientsForCalc.map((ing: any) => {
            const raw = ing.ingredient;
            const hasRelation = raw && (
              typeof raw === 'string' || 
              typeof raw === 'number' || 
              Array.isArray(raw) ||
              raw.documentId || 
              raw.id || 
              (raw.connect && Array.isArray(raw.connect) && raw.connect.length > 0)
            );

            if (!hasRelation && ing.id && existingRecipe?.ingredients) {
              const existingComp = existingRecipe.ingredients.find((ei: any) => ei.id === ing.id);
              if (existingComp?.ingredient) {
                return { ...ing, ingredient: existingComp.ingredient };
              }
            }
            return ing;
          });
        } else if (!ingredientsForCalc && isUpdate && existingRecipe) {
          ingredientsForCalc = existingRecipe.ingredients;
        }

        if (ingredientsForCalc) {
          const macros = await calculateRecipeMacros({ ingredients: ingredientsForCalc }, strapi);
          if (macros) {
            data.kcal = macros.kcal;
            data.macros = { protein: macros.protein, carbs: macros.carbs, fat: macros.fat, fiber: macros.fiber };
          }
        }

        if (ingredientsForCalc && Array.isArray(ingredientsForCalc)) {
          const ingredientIds = ingredientsForCalc
            .map((ing: any) => {
                const raw = ing.ingredient;
                if (!raw) return null;
                if (typeof raw === 'string') return raw;
                if (typeof raw === 'number') return raw.toString();
                if (raw.documentId) return raw.documentId;
                if (raw.id) return raw.id.toString();
                if (raw.connect && Array.isArray(raw.connect) && raw.connect.length > 0) {
                   const conn = raw.connect[0];
                   return typeof conn === 'object' ? (conn.documentId || conn.id?.toString()) : conn.toString();
                }
                return null;
            })
            .filter(Boolean);
          
          if (ingredientIds.length > 0) {
            data.used_ingredients = ingredientIds;
          }
        }

        // Auto-sync mealSlot (enumeration) z mealSlots (json) przy tworzeniu/edycji
        if (!data.mealSlot && Array.isArray(data.mealSlots) && data.mealSlots.length > 0) {
          data.mealSlot = data.mealSlots[0];
        }
      }

      let result;
      try {
        result = await next();
      } catch (err: any) {
        console.error(`[DOCUMENT MIDDLEWARE ERROR] ${uid} ${action}:`, err.message);
        throw err;
      }

      if (collectionName && ['create', 'update', 'delete', 'publish', 'unpublish'].includes(action)) {
        try {
          // KROK 1A: Bezpieczne pobranie docId
          const docId = (result as any)?.documentId ?? (params as any)?.documentId ?? (params as any)?.id;

          if (!docId) {
            console.error(`[FIREBASE SYNC ERROR] No docId for action=${action} uid=${uid}`);
            return result;
          }

          // KROK 1B: Obsługa unpublish (również przez update)
          const isUnpublishViaUpdate = action === 'update' && (params as any)?.data?.publishedAt === null;
          
          if (action === 'delete' || action === 'unpublish' || isUnpublishViaUpdate) {
            await db.collection(collectionName).doc(docId).delete();
            console.log(`[FIREBASE SYNC] Deleted ${uid} ${docId} from Firestore (${isUnpublishViaUpdate ? 'unpublish via update' : action})`);
          } else {
            // Synchronizujemy tylko jeśli dokument jest opublikowany (lub to akcja create/update, która docelowo ma być opublikowana)
            // W Strapi v5 documentId jest kluczem, a status publikacji sprawdzamy w result
            const isPublished = !!(result as any).publishedAt;

            if (!isPublished) {
              console.log(`[FIREBASE SYNC] Skipping sync for draft/unpublished ${uid} ${docId}`);
              return result;
            }

            // @ts-ignore
            const fullDoc: any = await (strapi.documents(uid as any) as any).findOne({
              documentId: docId,
              populate: uid === 'api::recipe.recipe' ? {
                ingredients: { populate: { ingredient: { fields: ['documentId'] } } },
                image: true,
                macros: true,
                profiles: { fields: ['slug', 'name'] }
              } : '*'
            });

            let dataToSync: any = { ...fullDoc };
            if (uid === 'api::recipe.recipe') {
              dataToSync.image = normalizeImageUrl(fullDoc.image);
              if (dataToSync.ingredients) {
                dataToSync.ingredients = dataToSync.ingredients.map((ing: any) => ({
                  ...ing,
                  id: ing.ingredient?.documentId || ing.ingredient || ""
                }));
              }
              if (!dataToSync.mealSlot && Array.isArray(dataToSync.mealSlots) && dataToSync.mealSlots.length > 0) {
                dataToSync.mealSlot = dataToSync.mealSlots[0];
              }
              if (Array.isArray(fullDoc.profiles)) {
                dataToSync.assignedProfiles = fullDoc.profiles.map((p: any) => p.slug || p.name);
              } else {
                dataToSync.assignedProfiles = [];
              }
            }

            await db.collection(collectionName).doc(docId).set(dataToSync, { merge: true });
            console.log(`[FIREBASE SYNC] Successfully synced ${uid} ${docId}`);
          }
        } catch (error: any) {
          console.error(`[FIREBASE SYNC ERROR] ${uid}:`, error.message);
        }
      }
      return result;
    });
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    console.log('--- [OH! ADMIN] Bootstrap initializing... ---');
    console.log('--- [MASTER SEEDER] Internal recovery is DISABLED (Manual management only) ---');

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
        }
      }
    } catch (err: any) {
      console.error('[PERMISSION GUARD ERROR]', err.message);
    }
  },
};
