import type { Core } from '@strapi/strapi';
import fs from 'fs';
import path from 'path';
import { db } from './lib/firebase';
// import OpenAI from 'openai'; // Re-enable if AI enrichment is restored

const collectionsToSync = {
  'api::recipe.recipe': 'recipes',
  'api::skladnik.skladnik': 'ingredients',
  'api::motivation-quote.motivation-quote': 'quotes',
  'api::profile.profile': 'profiles',
  'api::article.article': 'articles',
  'api::skin-care.skin-care': 'skincare',
  'api::training.training': 'training',
};

// ==================== AI ENRICHMENT UTILS — DISABLED ====================
// Data manually curated in production. Re-enable only when intentionally re-enriching.

// async function enrichIngredientWithAI(ing: any, strapi: any, openai: OpenAI) {
//   try {
//     const prompt = `You are a nutrition expert. For the ingredient "${ing.name}" (unit: ${ing.unitType}), provide: kcal, protein, carbs, fat, fiber per 100g/ml AND averagePieceWeight (only if unitType is piece). Return JSON only: {kcal, protein, carbs, fat, fiber, averagePieceWeight}. Use realistic values for natural products.`;
//     const completion = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: [{ role: "user", content: prompt }],
//       response_format: { type: "json_object" }
//     });
//     const aiData = JSON.parse(completion.choices[0].message.content || '{}');
//     if (aiData.kcal !== undefined) {
//       await strapi.documents('api::skladnik.skladnik').update({
//         documentId: ing.documentId,
//         data: { kcal: aiData.kcal, protein: aiData.protein, carbs: aiData.carbs, fat: aiData.fat,
//                 fiber: aiData.fiber, averagePieceWeight: aiData.averagePieceWeight || ing.averagePieceWeight,
//                 isAiEnriched: true } as any
//       });
//       return true;
//     }
//   } catch (e: any) {
//     console.warn(`[AI AGENT] Failed for ${ing.name}: ${e.message}`);
//   }
//   return false;
// }

// ==================== SEEDER UTILS ====================

function cleanIngredientName(raw: string): string {
    let name = raw.trim();
    name = name.replace(/\n/g, '').trim();
    name = name.replace(/\s+\d+[.,]?\d*\s*(g|ml|kg|l)$/i, '').trim();
    name = name.replace(/\s*\(.*?\)/g, '').trim();
    name = name.replace(/^\d+[.,/]?\d*\s+/, '').trim();
    name = name.replace(/[:;.,\-\s]+$/, '').trim();
    if (name.length > 0) {
        name = name.charAt(0).toUpperCase() + name.slice(1);
    }
    return name;
}

function normalizeForMatch(name: string): string {
    return name.toLowerCase().trim()
        .replace(/ł/g, 'l').replace(/ą/g, 'a').replace(/ć/g, 'c')
        .replace(/ę/g, 'e').replace(/ń/g, 'n').replace(/ó/g, 'o')
        .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
        .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function makeSlug(name: string): string {
    return normalizeForMatch(name).replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function isGarbage(name: string): boolean {
    const n = name.toLowerCase();
    if (name.length < 2 || name.length > 60) return true;
    if (/^\d/.test(name)) return true;
    if (/[½¼¾⅓⅔⅛]/.test(name)) return true;
    const garbagePatterns = ['szklanka', 'łyżka', 'łyżeczka', 'sztuk', 'garść', 'opakowanie', 'puszka', 'szczypta', 'plaster'];
    for (const p of garbagePatterns) {
        if (n === p || n.startsWith(p + ' ') || n.endsWith(' ' + p)) return true;
    }
    return false;
}

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
    console.log(`[MACRO CALC] rawIng format: ${typeof rawIng}`, JSON.stringify(rawIng));

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

    if (!lookupParams) {
      console.log(`[MACRO CALC] Could not determine lookup params for:`, JSON.stringify(rawIng));
      continue;
    }

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

    console.log(`[MACRO CALC] Ingredient lookup: ${cacheKey} -> ${ingDoc ? 'FOUND' : 'NOT FOUND'}`);

    if (ingDoc) {
      const amount = parseFloat(String(ingComponent.amount || '0').replace(',', '.')) || 0;
      const unit = (ingComponent.unit || 'g').toLowerCase();
      let factor = 0;

      if (ingComponent.weight && ingComponent.weight > 0) {
        // Priorytet: pole weight wypełnione przez parser (bezpośrednia waga w gramach)
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
      console.log(`[MACRO CALC] ${ingDoc.name} | unit=${unit} amt=${amount} weight=${ingComponent.weight || 0} factor=${factor.toFixed(3)} -> +${Math.round((Number(ingDoc.kcal) || 0) * factor)} kcal`);
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
        
        console.log(`[MACRO CALC] Triggered for ${action} on ${uid}. DocId: ${docId}`);

        let ingredientsForCalc = data.ingredients;
        let existingRecipe: any = null;

        // Pobieramy aktualny stan z bazy przy aktualizacji, aby uzupełnić brakujące relacje w komponentach
        if (isUpdate && docId) {
          try {
            existingRecipe = await (strapi.documents('api::recipe.recipe' as any) as any).findOne({
              documentId: docId,
              populate: { ingredients: { populate: { ingredient: true } } }
            });
          } catch (err: any) {
            console.warn(`[MACRO CALC] Could not fetch existing recipe: ${err.message}`);
          }
        }

        if (ingredientsForCalc && Array.isArray(ingredientsForCalc)) {
          // Naprawiamy listę składników: jeśli w payloadzie brakuje relacji (bo panel admina wysłał pusty connect/disconnect),
          // a komponent już istniał (ma id), to przywracamy relację z bazy danych.
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
                console.log(`[MACRO CALC] Component ${ing.id}: Relation missing in payload, restored from DB (${existingComp.ingredient.name || existingComp.ingredient.documentId})`);
                return { ...ing, ingredient: existingComp.ingredient };
              }
            }
            return ing;
          });
        } else if (!ingredientsForCalc && isUpdate && existingRecipe) {
          // Jeśli w ogóle nie ma składników w payloadzie (partial update), bierzemy wszystkie z bazy
          ingredientsForCalc = existingRecipe.ingredients;
          console.log(`[MACRO CALC] No ingredients in payload, using ${ingredientsForCalc?.length || 0} from DB`);
        }

        if (ingredientsForCalc) {
          const macros = await calculateRecipeMacros({ ingredients: ingredientsForCalc }, strapi);
          if (macros) {
            data.kcal = macros.kcal;
            data.macros = { protein: macros.protein, carbs: macros.carbs, fat: macros.fat, fiber: macros.fiber };
            console.log(`[MACRO CALC] Final result: kcal=${macros.kcal} P=${macros.protein} C=${macros.carbs} F=${macros.fat} Fb=${macros.fiber}`);
          }
        }

        // AUTO RELATIONS SYNC: Populate used_ingredients from the restored ingredients list
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
            console.log(`[RELATION SYNC] Syncing used_ingredients with ${ingredientIds.length} relations`);
          }
        }
      }

      let result;
      try {
        result = await next();
      } catch (err: any) {
        console.error(`[DOCUMENT MIDDLEWARE ERROR] ${uid} ${action}:`, err.message);
        throw err; // Re-throw to let Strapi handle it, but we've logged it
      }

      // LIVE AI ENRICHMENT — DISABLED (data manually curated in production, do not overwrite)
      // if ((uid as any) === 'api::skladnik.skladnik' && ['create', 'update'].includes(action)) {
      //   const doc = (result as any);
      //   if (doc && (doc.kcal === 0 || doc.kcal === null) && !doc.isAiEnriched) {
      //     const apiKey = process.env.OPENAI_API_KEY;
      //     if (apiKey) {
      //       const openai = new OpenAI({ apiKey });
      //       enrichIngredientWithAI(doc, strapi, openai).then(success => {
      //         if (success) console.log(`[AI AGENT] Live enrichment for: ${doc.name}`);
      //       });
      //     }
      //   }
      // }

      if (collectionName && ['create', 'update', 'delete', 'publish', 'unpublish'].includes(action)) {
        try {
          const docId = (result as any).documentId;
          if (action === 'delete' || action === 'unpublish') {
            await db.collection(collectionName).doc(docId).delete();
          } else {
            // @ts-ignore
            const fullDoc: any = await (strapi.documents(uid as any) as any).findOne({ 
              documentId: docId,
              populate: uid === 'api::recipe.recipe' ? { 
                ingredients: { populate: { ingredient: { fields: ['documentId'] } } },
                image: true,
                macros: true
              } : '*'
            });

            let dataToSync: any = { ...fullDoc };
            // Jeśli to przepis, mapujemy składniki na format czytelny dla aplikacji (ingredient -> id)
            if (uid === 'api::recipe.recipe') {
              dataToSync.image = normalizeImageUrl(fullDoc.image);
              if (dataToSync.ingredients) {
                dataToSync.ingredients = dataToSync.ingredients.map((ing: any) => ({
                  ...ing,
                  id: ing.ingredient?.documentId || ing.ingredient || ""
                }));
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
    console.log('--- [MASTER SEEDER] Internal recovery is DISABLED (Manual management only) ---');

    /* 
       Auto-importer logic was disabled on 2026-04-27 to prevent overwriting manual expert changes.
       To run recovery/sync, use dedicated maintenance scripts instead of bootstrap.
    */

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
