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
    if (typeof rawIng === 'string') {
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
    } else {
      try {
        // @ts-ignore
        ingDoc = await strapi.documents('api::skladnik.skladnik').findOne(lookupParams);
      } catch (err) {}
    }

    if (ingDoc) {
      const amount = Number(ingComponent.amount) || 0;
      const multiplier = amount / 100;
      totalKcal += (Number(ingDoc.kcal) || 0) * multiplier;
      totalProtein += (Number(ingDoc.protein) || 0) * multiplier;
      totalCarbs += (Number(ingDoc.carbs) || 0) * multiplier;
      totalFat += (Number(ingDoc.fat) || 0) * multiplier;
      totalFiber += (Number(ingDoc.fiber) || 0) * multiplier;
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
        console.log(`[MACRO CALC] Triggered for ${action} on ${uid}. Data ingredients:`, !!data.ingredients);

        // Przy partial update (np. zmiana opisu) składniki mogą nie być w payloadzie —
        // pobieramy je z bazy żeby zawsze przeliczyć makra poprawnie
        let ingredientsForCalc = data.ingredients;
        if (!ingredientsForCalc && action === 'update') {
          const docId = (params as any).documentId || (params as any).id;
          console.log(`[MACRO CALC] No ingredients in payload, fetching from DB for docId: ${docId}`);
          if (docId) {
            try {
              const existing = await (strapi.documents('api::recipe.recipe' as any) as any).findOne({
                documentId: docId,
                populate: { ingredients: { populate: { ingredient: true } } }
              });
              if (existing) {
                ingredientsForCalc = existing.ingredients;
                console.log(`[MACRO CALC] Fetched ${ingredientsForCalc?.length || 0} ingredients from DB`);
              }
            } catch (err: any) {
              console.warn(`[MACRO CALC] Could not fetch existing recipe ingredients: ${err.message}`);
            }
          }
        }

        if (ingredientsForCalc) {
          const macros = await calculateRecipeMacros({ ingredients: ingredientsForCalc }, strapi);
          if (macros) {
            data.kcal = macros.kcal;
            data.macros = { protein: macros.protein, carbs: macros.carbs, fat: macros.fat, fiber: macros.fiber };
            console.log(`[MACRO CALC] Result for recipe: kcal=${macros.kcal} P=${macros.protein} C=${macros.carbs} F=${macros.fat} Fb=${macros.fiber}`);
          }
        } else {
           console.log(`[MACRO CALC] Skipping calculation: no ingredients found.`);
        }

        // AUTO RELATIONS SYNC: Populate used_ingredients from the ingredients component list
        if (data.ingredients && Array.isArray(data.ingredients)) {
          const ingredientIds = data.ingredients
            .map((ing: any) => {
                const raw = ing.ingredient;
                if (typeof raw === 'string') return raw;
                if (typeof raw === 'number') return raw.toString(); // used_ingredients relation might expect documentId
                if (raw?.documentId) return raw.documentId;
                if (raw?.id) return raw.id.toString();
                return null;
            })
            .filter(Boolean);
          
          if (ingredientIds.length > 0) {
            data.used_ingredients = ingredientIds;
            console.log(`[RELATION SYNC] Auto-populated used_ingredients with ${ingredientIds.length} relations`);
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
        (async () => {
          try {
            const docId = (result as any).documentId;
            if (action === 'delete') {
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
            }
          } catch (error: any) {
            console.error(`[FIREBASE SYNC ERROR] ${uid}:`, error.message);
          }
        })();
      }
      return result;
    });
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    console.log('--- [MASTER SEEDER] Initializing internal recovery... ---');

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
      // 1. Ingredients Check
      // @ts-ignore
      const ingCount = await strapi.documents('api::skladnik.skladnik').count();
      if (ingCount === 0) {
        console.log('--- [MASTER SEEDER] Step 1: Loading Golden Ingredients ---');
        const goldenPath = path.join(process.cwd(), 'data/golden-ingredients.json');
        if (fs.existsSync(goldenPath)) {
          const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
          for (const ing of golden) {
            // @ts-ignore
            await strapi.documents('api::skladnik.skladnik').create({
              data: { ...ing, slug: makeSlug(ing.name) } as any
            });
          }
          console.log(`--- [MASTER SEEDER] Created ${golden.length} golden ingredients. ---`);
        }
      } else {
        console.log(`--- [MASTER SEEDER] Found ${ingCount} ingredients, skipping Step 1. ---`);
      }

      // 2. Ingredients Check (Continued)
      console.log('--- [MASTER SEEDER] Step 2: Processing Recipes & Missing Ingredients ---');
      const recipesPath = path.join(process.cwd(), 'data/recipes.json');
      if (fs.existsSync(recipesPath)) {
        const recipes = JSON.parse(fs.readFileSync(recipesPath, 'utf8'));
        
        const ingMap = new Map<string, string>();
        // @ts-ignore
        const currentIngs = await strapi.documents('api::skladnik.skladnik').findMany({ limit: -1 });
        for (const i of (currentIngs as any)) {
          ingMap.set(normalizeForMatch(i.name), i.documentId);
        }

        // Cache existing recipes to avoid duplicates
        // @ts-ignore
        const existingRecipes = await strapi.documents('api::recipe.recipe').findMany({ fields: ['name'], limit: -1 });
        const existingRecipeNames = new Set((existingRecipes as any).map((r: any) => r.name));

        for (const recipeData of recipes) {
          const recipeName = (recipeData.name || '').replace(/\n/g, '').trim();
          
          if (existingRecipeNames.has(recipeName)) {
            continue; // Skip already imported
          }

          await sleep(30); // Even more breath for Postgres
          
          const components = [];
          for (const ing of recipeData.ingredients) {
            const cleanName = cleanIngredientName(ing.name);
            const norm = normalizeForMatch(cleanName);
            const slug = makeSlug(cleanName);
            
            if (isGarbage(cleanName)) continue;

            let docId = ingMap.get(norm);
            if (!docId) {
              // Create missing
              try {
                // @ts-ignore
                const newIng = await strapi.documents('api::skladnik.skladnik').create({
                  data: {
                    name: cleanName, slug, category: 'inne', kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
                    unitType: (ing.unit === 'szt' || ing.unit === 'opakowanie') ? 'piece' : 'weight'
                  } as any
                });
                docId = (newIng as any).documentId;
                ingMap.set(norm, docId!);
              } catch (e) {}
            }

            components.push({
              __component: 'shared.ingredient',
              name: cleanName,
              slug,
              ingredient: docId,
              amount: ing.amount || 0,
              unit: ing.unit || 'g',
              weight: ing.weight || 0,
            });
          }

          if (components.length > 0) {
            try {
              // @ts-ignore
              const usedIngIds = components.map(c => c.ingredient).filter(Boolean);

              // @ts-ignore
              const newRecipe = await strapi.documents('api::recipe.recipe').create({
                data: {
                  name: recipeName, description: recipeData.description || '', preparation: recipeData.preparation || '',
                  prepTime: recipeData.prepTime || 0, servings: recipeData.servings || 1, mealSlots: recipeData.mealSlot || [],
                  ingredients: components, 
                  used_ingredients: usedIngIds, // <--- Link relations
                  kcal: 0, macros: { protein: 0, carbs: 0, fat: 0, fiber: 0 },
                  tags: Array.isArray(recipeData.tags) ? recipeData.tags.join(', ') : '',
                } as any
              });
              // @ts-ignore
              await strapi.documents('api::recipe.recipe').publish({ documentId: (newRecipe as any).documentId });
            } catch (e: any) {
              console.warn(`--- [MASTER SEEDER] Failed to create recipe [${recipeName}]: ${e.message} ---`);
            }
          }
        }
        console.log(`--- [MASTER SEEDER] Finished importing recipes. ---`);
      }

      // 3. Sync relations for existing recipes (One-time fix)
      console.log('--- [MASTER SEEDER] Step 3: Syncing relations for existing recipes... ---');
      // @ts-ignore
      const recipesToFix = await strapi.documents('api::recipe.recipe').findMany({
        populate: {
          ingredients: {
            populate: { ingredient: true }
          },
          used_ingredients: {
            fields: ['documentId']
          }
        },
        limit: -1
      });

      let fixCount = 0;
      for (const r of (recipesToFix as any)) {
        const componentIngIds = r.ingredients?.map((i: any) => i.ingredient?.documentId).filter(Boolean) || [];
        const currentRelIds = r.used_ingredients?.map((i: any) => i.documentId) || [];
        
        if (componentIngIds.length > 0 && currentRelIds.length === 0) {
          // @ts-ignore
          await strapi.documents('api::recipe.recipe').update({
            documentId: r.documentId,
            data: { used_ingredients: componentIngIds } as any
          });
          fixCount++;
          await sleep(20);
        }
      }
      console.log(`--- [MASTER SEEDER] Synced relations for ${fixCount} recipes. ---`);
      
      // 4. AI ENRICHMENT AGENT — DISABLED (data manually curated in production, do not overwrite)
      console.log('--- [MASTER SEEDER] Step 4: AI Enrichment DISABLED (data manually curated) ---');
      // const apiKey = process.env.OPENAI_API_KEY;
      // if (apiKey) {
      //   const openai = new OpenAI({ apiKey });
      //   const missingIngs = await strapi.documents('api::skladnik.skladnik').findMany({
      //     filters: { $or: [{ kcal: 0 }, { kcal: { $null: true } }] } as any,
      //     limit: 300
      //   });
      //   const toEnrich = (missingIngs as any).filter((i: any) => i.isAiEnriched !== true);
      //   if (toEnrich.length > 0) {
      //     const BATCH_SIZE = 5;
      //     for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
      //       const chunk = toEnrich.slice(i, i + BATCH_SIZE);
      //       await Promise.all(chunk.map((ing: any) => enrichIngredientWithAI(ing, strapi, openai)));
      //     }
      //   }
      // }

      // 5. FULL FIREBASE SYNC (To ensure everything is in Firestore)
      console.log('--- [MASTER SEEDER] Step 5: Full Firebase Synchronization... ---');
      
      // A. Fetch All Ingredients & Build RAM Map
      // @ts-ignore
      const allSkladniki = await strapi.documents('api::skladnik.skladnik').findMany({ limit: -1 });
      const ingCache = new Map<string, any>();
      
      const CHUNK_SIZE = 400;
      for (let i = 0; i < (allSkladniki as any).length; i += CHUNK_SIZE) {
        const chunk = (allSkladniki as any).slice(i, i + CHUNK_SIZE);
        const batch = db.batch();
        for (const ing of chunk) {
          ingCache.set(ing.documentId, ing);
          const ref = db.collection('ingredients').doc(ing.documentId);
          batch.set(ref, { ...ing, id: ing.documentId }, { merge: true });
        }
        await batch.commit();
        console.log(`--- [MASTER SEEDER] Committed batch for ingredients ${i} to ${i + chunk.length} ---`);
      }
      console.log(`--- [MASTER SEEDER] Pushed ${allSkladniki.length} ingredients to Firebase. ---`);

      // B. Sync Recipes with Deep Populate & Image Mapping
      // @ts-ignore
      const allRecipes = await strapi.documents('api::recipe.recipe').findMany({ 
        populate: { 
          ingredients: { populate: { ingredient: { fields: ['documentId'] } } },
          image: true,
          macros: true
        },
        limit: -1 
      });
      
      let recipeSyncCount = 0;
      for (const r of (allRecipes as any)) {
        const ref = db.collection('recipes').doc(r.documentId);
        
        // Ponowne przeliczenie makr z użyciem Cache (RAM)
        const macros = await calculateRecipeMacros(r, strapi, ingCache);
        
        const dataToSync: any = { 
          ...r, 
          id: r.documentId,
          kcal: macros?.kcal || r.kcal || 0,
          macros: macros || r.macros || { protein: 0, carbs: 0, fat: 0, fiber: 0 },
          // Obsługa obrazka (wyciągamy absolutny URL)
          image: normalizeImageUrl(r.image)
        };
        
        // Mapujemy komponenty składników (id zamiast ingredient)
        if (dataToSync.ingredients) {
          dataToSync.ingredients = dataToSync.ingredients.map((ing: any) => ({
            ...ing,
            id: ing.ingredient?.documentId || ing.ingredient || ""
          }));
        }

        await ref.set(dataToSync, { merge: true });
        recipeSyncCount++;
        
        if (recipeSyncCount % 20 === 0) {
          console.log(`--- [MASTER SEEDER] Synced ${recipeSyncCount} recipes... ---`);
        }
      }
      console.log(`--- [MASTER SEEDER] Successfully pushed ${allRecipes.length} recipes to Firebase. ---`);

      // 6. FULL ARTICLE SYNC
      console.log('--- [MASTER SEEDER] Step 6: Full Article Synchronization... ---');
      // @ts-ignore
      const allArticles = await strapi.documents('api::article.article').findMany({
        status: 'published',
        populate: ['thumbnail', 'profiles'],
        limit: -1
      });

      const articleBatch = db.batch();
      for (const article of (allArticles as any)) {
        const ref = db.collection('articles').doc(article.documentId);
        const data = {
          ...article,
          id: article.documentId,
          thumbnail: article.thumbnail?.url || article.thumbnail || ""
        };
        articleBatch.set(ref, data, { merge: true });
      }
      if ((allArticles as any).length > 0) {
        await articleBatch.commit();
        console.log(`--- [MASTER SEEDER] Successfully pushed ${allArticles.length} articles. ---`);
      }
      console.log('--- [MASTER SEEDER] Recovery complete. ---');
    } catch (error: any) {
      console.error('--- [MASTER SEEDER ERROR] ---', error.message);
    }

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
