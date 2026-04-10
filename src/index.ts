import type { Core } from '@strapi/strapi';
import fs from 'fs';
import path from 'path';
import { db } from './lib/firebase';

const collectionsToSync = {
  'api::recipe.recipe': 'recipes',
  'api::skladnik.skladnik': 'ingredients',
  'api::motivation-quote.motivation-quote': 'quotes',
  'api::profile.profile': 'profiles',
};

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
      const ingDoc: any = await strapi.documents('api::skladnik.skladnik').findOne({
        documentId: ingComponent.ingredient.documentId || ingComponent.ingredient,
      });

      if (ingDoc) {
        const amount = ingComponent.amount || 0;
        const multiplier = amount / 100;
        totalKcal += (ingDoc.kcal || 0) * multiplier;
        totalProtein += (ingDoc.protein || 0) * multiplier;
        totalCarbs += (ingDoc.carbs || 0) * multiplier;
        totalFat += (ingDoc.fat || 0) * multiplier;
        totalFiber += (ingDoc.fiber || 0) * multiplier;
      }
    } catch (err) {}
  }

  return {
    kcal: Math.round(totalKcal),
    protein: Math.round(totalProtein),
    carbs: Math.round(totalCarbs),
    fat: Math.round(totalFat),
    fiber: Math.round(totalFiber),
  };
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
        const macros = await calculateRecipeMacros(data, strapi);
        if (macros) {
          data.kcal = macros.kcal;
          data.macros = { protein: macros.protein, carbs: macros.carbs, fat: macros.fat, fiber: macros.fiber };
        }
      }

      const result = await next();

      if (collectionName && ['create', 'update', 'delete', 'publish', 'unpublish'].includes(action)) {
        (async () => {
          try {
            const docId = (result as any).documentId;
            if (action === 'delete') {
              await db.collection(collectionName).doc(docId).delete();
            } else {
              // @ts-ignore
              const fullDoc = await strapi.documents(uid).findOne({ 
                documentId: docId,
                populate: uid === 'api::recipe.recipe' ? ['ingredients'] : []
              });

              let dataToSync = { ...fullDoc };
              // Jeśli to przepis, mapujemy składniki na format czytelny dla aplikacji (ingredient -> id)
              if (uid === 'api::recipe.recipe' && dataToSync.ingredients) {
                dataToSync.ingredients = dataToSync.ingredients.map((ing: any) => ({
                  ...ing,
                  id: ing.ingredient?.documentId || ing.ingredient
                }));
              }
              
              await db.collection(collectionName).doc(docId).set(dataToSync, { merge: true });
            }
          } catch (error) {
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
      
      // 4. FULL FIREBASE SYNC (To ensure everything is in Firestore)
      console.log('--- [MASTER SEEDER] Step 4: Full Firebase Synchronization... ---');
      
      // A. Sync Ingredients
      // @ts-ignore
      const allSkladniki = await strapi.documents('api::skladnik.skladnik').findMany({ limit: -1 });
      const ingBatch = db.batch();
      for (const ing of (allSkladniki as any)) {
        const ref = db.collection('ingredients').doc(ing.documentId);
        ingBatch.set(ref, { ...ing, id: ing.documentId }, { merge: true });
      }
      await ingBatch.commit();
      console.log(`--- [MASTER SEEDER] Pushed ${allSkladniki.length} ingredients to Firebase. ---`);

      // B. Sync Recipes
      // @ts-ignore
      const allRecipes = await strapi.documents('api::recipe.recipe').findMany({ 
        populate: ['ingredients'],
        limit: -1 
      });
      
      let recipeSyncCount = 0;
      for (const r of (allRecipes as any)) {
        const ref = db.collection('recipes').doc(r.documentId);
        const dataToSync = { ...r, id: r.documentId };
        
        // Mapujemy komponenty składników na format Firebase (id zamiast ingredient)
        if (dataToSync.ingredients) {
          dataToSync.ingredients = dataToSync.ingredients.map((ing: any) => ({
            ...ing,
            id: ing.ingredient?.documentId || ing.ingredient
          }));
        }

        await ref.set(dataToSync, { merge: true });
        recipeSyncCount++;
        if (recipeSyncCount % 50 === 0) await sleep(100); // Małe przerwy dla stabilności
      }
      console.log(`--- [MASTER SEEDER] Pushed ${allRecipes.length} recipes to Firebase. ---`);

    } catch (error: any) {
      console.error('--- [MASTER SEEDER] CRITICAL ERROR:', error.message);
    }
  },
};
