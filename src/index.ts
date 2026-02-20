import type { Core } from '@strapi/strapi';
import fs from 'fs';
import path from 'path';
import { db } from './lib/firebase';

const UNIT_CONVERSIONS: Record<string, number> = {
  'g': 1,
  'ml': 1,
  'lyzka': 15,
  'lyzeczka': 5,
  'szklanka': 250,
  'szczypta': 1,
  'garstka': 30,
  'plaster': 20, /* Default estimate if averagePieceWeight is missing */
};

async function calculateRecipeMacros(data: any) {
  if (!data.ingredients || !Array.isArray(data.ingredients)) {
    return null;
  }

  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;

  console.log(`[MACRO-CALC] Starting calculation for: ${data.name || 'Unknown'}. Ingredients:`, JSON.stringify(data.ingredients));

  for (const ing of data.ingredients) {
    if (!ing.name || !ing.amount) continue;

    try {
      // Try direct lookup by name as ID first
      let doc = await db.collection('ingredients').doc(ing.name).get();
      let nutrition = doc.data();

      // If not found by ID, search by 'name' field
      if (!doc.exists) {
        const snapshot = await db.collection('ingredients').where('name', '==', ing.name).limit(1).get();
        if (!snapshot.empty) {
          doc = snapshot.docs[0];
          nutrition = doc.data() as any;
        }
      }

      if (!doc.exists || !nutrition) {
        console.warn(`[MACRO-CALC] Ingredient NOT found in Firebase for name/ID: "${ing.name}"`);
        continue;
      }

      console.log(`[MACRO-CALC] Found ingredient "${ing.name}":`, { kcal: nutrition.kcal, unitType: nutrition.unitType });

      let factor = 0;
      const unit = ing.unit || 'g';
      const amount = parseFloat(ing.amount) || 0;

      if (nutrition.unitType === 'piece') {
        if (unit === 'szt' || unit === 'opakowanie') {
          factor = amount;
        } else if (UNIT_CONVERSIONS[unit]) {
          const weightInGrams = amount * UNIT_CONVERSIONS[unit];
          factor = weightInGrams / (nutrition.averagePieceWeight || 100);
        } else {
          factor = amount;
        }
      } else {
        let weightInGrams = 0;
        if (UNIT_CONVERSIONS[unit]) {
          weightInGrams = amount * UNIT_CONVERSIONS[unit];
        } else if (unit === 'szt' || unit === 'opakowanie') {
          weightInGrams = amount * (nutrition.averagePieceWeight || 100);
        } else {
          weightInGrams = amount;
        }
        factor = weightInGrams / 100;
      }

      totalKcal += (nutrition.kcal || 0) * factor;
      totalProtein += (nutrition.protein || 0) * factor;
      totalCarbs += (nutrition.carbs || 0) * factor;
      totalFat += (nutrition.fat || 0) * factor;
      totalFiber += (nutrition.fiber || 0) * factor;

    } catch (err) {
      console.error(`[MACRO-CALC] Error fetching ingredient ${ing.name}:`, err);
    }
  }

  return {
    kcal: Math.round(totalKcal),
    macros: {
      protein: Math.round(totalProtein),
      carbs: Math.round(totalCarbs),
      fat: Math.round(totalFat),
      fiber: Math.round(totalFiber),
    }
  };
}

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    strapi.customFields.register({
      name: 'ingredient',
      // @ts-ignore
      plugin: 'ingredient-lookup',
      type: 'string',
    });

    strapi.customFields.register({
      name: 'ingredient-lookup',
      // @ts-ignore
      plugin: 'ingredient-lookup',
      type: 'string',
    });
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // --- 1. Seed Profiles ---
    const profiles = [
      { name: 'Opanuj Cukier', slug: 'opanuj-cukier', description: 'Program skupiony na stabilizacji poziomu glukozy i insuliny.', mainColor: '#E9D5CA' },
      { name: 'Opanuj Skórę', slug: 'opanuj-skore', description: 'Program celowany w redukcję trądziku dorosłych i stanów zapalnych.', mainColor: '#FFFFFF' },
      { name: 'Opanuj Stres', slug: 'opanuj-stres', description: 'Techniki i suplementacja obniżająca poziom kortyzolu.', mainColor: '#F6F1EB' },
      { name: 'Glow-up', slug: 'glow-up', description: 'Kompleksowe wsparcie urody i energii przez optymalizację hormonalną.', mainColor: '#A3B18A' },
    ];

    console.log('[SEED] Starting profile seeding...');

    for (const data of profiles) {
      // @ts-ignore
      const existing = await strapi.documents('api::profile.profile').findMany({
        filters: { slug: data.slug },
      });

      if (existing.length === 0) {
        // @ts-ignore
        await strapi.documents('api::profile.profile').create({
          data: {
            ...data,
            publishedAt: new Date(),
          },
          status: 'published',
        });
        console.log(`[SEED] Created profile: ${data.name}`);
      } else {
        console.log(`[SEED] Profile already exists: ${data.name}`);
      }
    }

    // --- 2. Seed Expert Tutorial ---
    try {
      const tutorialPath = path.join(process.cwd(), 'TUTORIAL_EKSPERT.md');
      if (fs.existsSync(tutorialPath)) {
        const content = fs.readFileSync(tutorialPath, 'utf8');

        // @ts-ignore
        const existingInstruction = await strapi.documents('api::instruction.instruction').findFirst();

        if (!existingInstruction) {
          // @ts-ignore
          await strapi.documents('api::instruction.instruction').create({
            data: {
              content,
              publishedAt: new Date(),
            },
            status: 'published',
          });
          console.log('[SEED] Expert Tutorial seeded successfully.');
        } else {
          // Update tutorial if it already exists to keep it in sync
          // @ts-ignore
          await strapi.documents('api::instruction.instruction').update({
            documentId: existingInstruction.documentId,
            data: {
              // @ts-ignore
              content,
            },
            status: 'published',
          });
          console.log('[SEED] Expert Tutorial updated.');
        }
      }
    } catch (error) {
      console.error('[SEED] Failed to seed tutorial:', error);
    }

    // --- 3. Seed Motivation Quotes ---
    const quotes: any[] = [
      { text: "Nowa energia! Faza folikularna to idealny moment na planowanie i nowe projekty.", author: "Hormonalny Balans", assignedPhase: "follicular" },
      { text: "Zwolnij. Twoje ciało jest w fazie lutealnej. Bądź dla siebie wyrozumiała.", author: "Czuła Lutealna", assignedPhase: "luteal" },
    ];

    for (const data of quotes) {
      // @ts-ignore
      const existing = await strapi.documents('api::motivation-quote.motivation-quote').findMany({
        filters: { text: data.text },
      });

      if (existing.length === 0) {
        // @ts-ignore
        await strapi.documents('api::motivation-quote.motivation-quote').create({
          data: {
            ...data,
            publishedAt: new Date(),
          },
          status: 'published',
        });
      }
    }

    console.log('[SEED] Seeding completed.');

    // --- 3. Firestore Sync Lifecycles ---
    const collectionsToSync = {
      'api::article.article': 'articles',
      'api::habit.habit': 'habits',
      'api::recipe.recipe': 'recipes',
      'api::profile.profile': 'profiles',
      'api::motivation-quote.motivation-quote': 'quotes',
      'api::skin-care.skin-care': 'skincare',
      'api::training.training': 'training',
      'api::instruction.instruction': 'instructions',
    };

    const syncToFirestore = async (uid: string, result: any, action: 'create' | 'update' | 'delete') => {
      const collectionName = collectionsToSync[uid as keyof typeof collectionsToSync];
      if (!collectionName) return;

      try {
        if (action === 'delete') {
          // Use the Strapi documentId for deletion in Firestore
          await db.collection(collectionName).doc(result.documentId).delete();
          console.log(`[FIREBASE] Deleted from ${collectionName}: ${result.documentId}`);
        } else {
          // For create/update, sync the data
          // We only sync 'published' content to avoid showing drafts in the app
          if (result.status === 'published' || result.publishedAt) {
            const dataToSync = {
              ...result,
              updatedAt: new Date().toISOString(),
              source: 'strapi',
            };

            // Delete unnecessary Strapi fields before syncing to Firestore
            delete dataToSync.id;
            delete dataToSync.createdBy;
            delete dataToSync.updatedBy;

            await db.collection(collectionName).doc(result.documentId).set(dataToSync, { merge: true });
            console.log(`[FIREBASE] Synced ${action} to ${collectionName}: ${result.documentId}`);
          }
        }
      } catch (error) {
        console.error(`[FIREBASE] Sync error for ${collectionName}:`, error);
      }
    };

    // Subscribe to lifecycles for all relevant content types
    Object.keys(collectionsToSync).forEach((uid) => {
      strapi.db.lifecycles.subscribe({
        models: [uid],
        async afterCreate(event) {
          const { result } = event;

          if (uid === 'api::recipe.recipe' && result.ingredients) {
            // Run entirely outside the lifecycle transaction to prevent transaction rollback/striping bugs in Strapi 5
            setTimeout(() => {
              handleRecipeMacrosUpdate(result.id, result.documentId, result).catch(e => console.error(e));
            }, 100);
          }

          await syncToFirestore(uid, result, 'create');
        },
        async afterUpdate(event) {
          const { result, params } = event;

          if (uid === 'api::recipe.recipe' && result) {
            // Trigger macro recalculation only if ingredients were updated
            // Due to Strapi structure, we sometimes only get ingredients in result, sometimes in params.data
            if (params.data?.ingredients) {
              // Run entirely outside the lifecycle transaction
              setTimeout(() => {
                handleRecipeMacrosUpdate(result.id, result.documentId, result).catch(e => console.error(e));
              }, 100);
            }
          }

          await syncToFirestore(uid, result, 'update');
        },
        async afterDelete(event) {
          const { result } = event;
          await syncToFirestore(uid, result, 'delete');
        },
      });
    });

    console.log('[FIREBASE] Sync lifecycles registered for all content types.');
  },
};

async function handleRecipeMacrosUpdate(id: number, documentId: string, recipeData: any) {
  console.log(`[MACRO-CALC] Backend trigger for recipe ${documentId} (id: ${id})`);
  if (!recipeData.ingredients) {
    console.log(`[MACRO-CALC] No ingredients found in recipe data for ${documentId}`);
    return;
  }
  try {
    const calculated = await calculateRecipeMacros(recipeData);
    if (!calculated) {
      console.log(`[MACRO-CALC] Calculation returned null for ${documentId}`);
      return;
    }

    console.log(`[MACRO-CALC] Calculated results for ${documentId}:`, calculated);

    // First, save the updated kcal directly
    await strapi.db.query('api::recipe.recipe').update({
      where: { documentId },
      data: { kcal: calculated.kcal }
    });

    // Check if recipe already has a linked component
    const existingRecipe = await strapi.documents('api::recipe.recipe').findOne({
      documentId: documentId,
      populate: ['macros']
    });

    let macrosId = existingRecipe?.macros?.id;

    if (macrosId) {
      // Update existing physical component row
      await strapi.db.query('shared.macros').update({
        where: { id: macrosId },
        data: calculated.macros
      });
      console.log(`[MACRO-CALC] Updated existing macros component row ID: ${macrosId}`);
    } else {
      // Create new physical component row
      const newMacros = await strapi.db.query('shared.macros').create({
        data: calculated.macros
      });
      macrosId = newMacros.id;
      console.log(`[MACRO-CALC] Created new macros component row ID: ${macrosId}`);
    }

    // Link the component row ID to the recipe ID via Strapi's polymorphic CMP table
    const knex = strapi.db.getConnection();

    // Attempt to resolve the correct pivot table name for components in Strapi 5
    // In SQLite it's usually {content_type}_cmps, in Postgres it might be different.
    // We'll check for recipes_cmps first, then fallback to recipes_components or use metadata
    let pivotTable = 'recipes_cmps';

    try {
      const hasCmps = await knex.schema.hasTable('recipes_cmps');
      if (!hasCmps) {
        const hasComponents = await knex.schema.hasTable('recipes_components');
        if (hasComponents) pivotTable = 'recipes_components';
        else {
          // Last resort: try to find any join table associated with the macros field
          const metadata = strapi.db.metadata.get('api::recipe.recipe');
          // @ts-ignore
          const attr = metadata?.attributes?.macros;
          // @ts-ignore
          if (attr?.joinTable?.name) pivotTable = attr.joinTable.name;
        }
      }
    } catch (e) {
      console.warn('[MACRO-CALC] Error resolving pivot table name, defaulting to recipes_cmps');
    }

    console.log(`[MACRO-CALC] Using pivot table: ${pivotTable} for recipe ${id}`);

    const existingLink = await knex(pivotTable)
      .where({ entity_id: id, field: 'macros', component_type: 'shared.macros' })
      .first();

    if (existingLink) {
      await knex(pivotTable)
        .where({ id: existingLink.id })
        .update({ cmp_id: macrosId });
    } else {
      await knex(pivotTable).insert({
        entity_id: id,
        cmp_id: macrosId,
        component_type: 'shared.macros',
        field: 'macros',
        "order": 1
      });
    }

    console.log(`[MACRO-CALC] Successfully attached macros to recipe ${documentId} via raw SQL pivot`);

  } catch (err) {
    console.error('[MACRO-CALC] Critical error modifying DB components:', err);
  }
}
