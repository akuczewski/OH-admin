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
      console.log(`[MACRO-CALC] Searching for ingredient: "${ing.name}"`);
      // Try direct lookup by name as ID first
      let doc = await db.collection('ingredients').doc(ing.name).get();
      let nutrition = doc.data();

      // If not found by ID, search by 'name' field
      if (!doc.exists) {
        console.log(`[MACRO-CALC] Not found by ID "${ing.name}", searching by 'name' field...`);
        const snapshot = await db.collection('ingredients').where('name', '==', ing.name).limit(1).get();
        if (!snapshot.empty) {
          doc = snapshot.docs[0];
          nutrition = doc.data() as any;
          console.log(`[MACRO-CALC] Found by 'name' field: "${ing.name}"`);
        }
      }

      if (!doc.exists || !nutrition) {
        console.warn(`[MACRO-CALC] Ingredient NOT found in Firebase: "${ing.name}"`);
        continue;
      }

      console.log(`[MACRO-CALC] Loaded data for "${ing.name}":`, {
        kcal: nutrition.kcal,
        unitType: nutrition.unitType,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat
      });

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
        async beforeCreate(event) {
          const { params } = event;
          if (uid === 'api::recipe.recipe' && params.data?.ingredients) {
            console.log('[MACRO-CALC] beforeCreate: Calculating macros atomicaly');
            const calculated = await calculateRecipeMacros(params.data);
            if (calculated) {
              params.data.kcal = calculated.kcal;
              params.data.macros = calculated.macros;
              console.log('[MACRO-CALC] beforeCreate: Set macros:', calculated);
            }
          }
        },
        async beforeUpdate(event) {
          const { params } = event;
          if (uid === 'api::recipe.recipe') {
            console.log('[MACRO-CALC] beforeUpdate: Fetching existing recipe for comparison');

            try {
              // We NEED to fetch existing macros ID for Strapi 5 to merge correctly
              const existing = await strapi.db.query('api::recipe.recipe').findOne({
                where: params.where,
                populate: ['ingredients', 'macros']
              });

              const payload = { ...params.data };

              // Use existing ingredients if not provided in update payload
              if (!payload.ingredients && existing?.ingredients) {
                payload.ingredients = existing.ingredients;
                console.log(`[MACRO-CALC] beforeUpdate: Re-using ${existing.ingredients.length} existing ingredients`);
              }

              if (payload.ingredients && Array.isArray(payload.ingredients)) {
                const calculated = await calculateRecipeMacros(payload);
                if (calculated) {
                  params.data.kcal = calculated.kcal;

                  // CRITICAL: Include existing ID so Strapi 5 updates the same row instead of replacing
                  if (existing?.macros?.id) {
                    params.data.macros = {
                      id: existing.macros.id,
                      ...calculated.macros
                    };
                    console.log(`[MACRO-CALC] beforeUpdate: Merging with existing macros ID: ${existing.macros.id}`);
                  } else {
                    params.data.macros = calculated.macros;
                    console.log('[MACRO-CALC] beforeUpdate: Creating new macros component');
                  }
                }
              } else {
                console.log('[MACRO-CALC] beforeUpdate: No ingredients available for calculation');
              }
            } catch (err) {
              console.error('[MACRO-CALC] beforeUpdate error:', err);
            }
          }
        },
        async afterCreate(event) {
          const { result } = event;
          await syncToFirestore(uid, result, 'create');
        },
        async afterUpdate(event) {
          const { result } = event;
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


