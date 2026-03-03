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

  console.log(`[MACRO-CALC-V5] Starting calculation for: ${data.name || 'Recipe'}.`);

  for (const ing of data.ingredients) {
    if (!ing.name || !ing.amount) continue;

    try {
      const searchId = ing.slug || ing.name;

      // Try direct lookup by slug/name as ID
      let doc = await db.collection('ingredients').doc(searchId).get();
      let nutrition = doc.data();

      // Fallback: search by 'name' field
      if (!doc.exists) {
        const snapshot = await db.collection('ingredients').where('name', '==', ing.name).limit(1).get();
        if (!snapshot.empty) {
          doc = snapshot.docs[0];
          nutrition = doc.data() as any;
        }
      }

      // Secondary fallback: search by 'slug' field
      if (!doc.exists && ing.slug) {
        const snapshot = await db.collection('ingredients').where('slug', '==', ing.slug).limit(1).get();
        if (!snapshot.empty) {
          doc = snapshot.docs[0];
          nutrition = doc.data() as any;
        }
      }

      if (!doc.exists || !nutrition) {
        console.warn(`[MACRO-CALC-V5] NOT FOUND: "${ing.name}"`);
        continue;
      }

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
      console.error(`[MACRO-CALC-V5] Error at ${ing.name}:`, err);
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
      { text: "To czas na zasłużony odpoczynek. Bądź łagodna dla swojego ciała.", author: "Czuła Ja", assignedPhase: "menstruation" },
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
      if (!collectionName || !result) return;

      console.log(`[FIREBASE-DEBUG] ${action.toUpperCase()} entry in ${uid}. Result keys: ${Object.keys(result).join(', ')}`);

      const getDocId = (res: any) => res.documentId || res.document_id || res.id;
      const docId = getDocId(result);

      if (!docId) {
        console.warn(`[FIREBASE] Cannot sync ${uid}: No document ID found.`);
        return;
      }

      // Extract slugs for relation arrays if they are populated as objects
      const flattenRelations = (data: any) => {
        const flat = { ...data };
        if (Array.isArray(flat.assignedProfiles)) {
          flat.assignedProfiles = flat.assignedProfiles.map((p: any) => typeof p === 'string' ? p : (p.slug || p.name || p));
        }
        if (Array.isArray(flat.assignedPhases)) {
          flat.assignedPhases = flat.assignedPhases.map((p: any) => typeof p === 'string' ? p : (p.slug || p.name || p));
        }
        return flat;
      };

      try {
        const isPublished = result.status === 'published' || !!result.publishedAt || !!result.published_at;
        console.log(`[FIREBASE-DEBUG] docId: ${docId}, isPublished: ${isPublished}, result.status: ${result.status}`);

        if (action === 'delete' || (!isPublished && action === 'update')) {
          // If action is delete OR item is no longer published, remove from Firestore
          await db.collection(collectionName).doc(docId).delete();
          console.log(`[FIREBASE] Deleted/Unpublished from ${collectionName}: ${docId}`);
        } else if (isPublished) {
          // For create/update, sync data ONLY if it is published
          let dataToSync = {
            ...result,
            updatedAt: new Date().toISOString(),
            source: 'strapi',
          };

          dataToSync = flattenRelations(dataToSync);

          // Clean up Strapi-specific fields
          delete dataToSync.id;
          delete dataToSync.documentId;
          delete dataToSync.document_id;
          delete dataToSync.createdBy;
          delete dataToSync.updatedBy;

          await db.collection(collectionName).doc(docId).set(dataToSync, { merge: true });
          console.log(`[FIREBASE] SUCCESS Synced ${action} to ${collectionName}: ${docId}`);
        } else {
          console.log(`[FIREBASE] Skipping sync for ${collectionName}: ${docId} (draft status)`);
        }
      } catch (error) {
        console.error(`[FIREBASE] Sync error for ${collectionName} (${docId}):`, error);
      }
    };

    // Subscribe to lifecycles for all relevant content types
    Object.keys(collectionsToSync).forEach((uid) => {
      strapi.db.lifecycles.subscribe({
        models: [uid],
        async beforeCreate(event) {
          const { params, state } = event;
          if (uid === 'api::recipe.recipe' && params.data?.ingredients) {
            console.log('[MACRO-CALC-V4] beforeCreate: Calculating macros atomicaly');
            const calculated = await calculateRecipeMacros(params.data);
            if (calculated) {
              params.data.kcal = calculated.kcal;
              params.data.macros = calculated.macros;
              state.calculatedMacros = calculated.macros; // Save to state for afterCreate hook!
              console.log('[MACRO-CALC-V4] beforeCreate: Set macros:', calculated);
            }
          }
        },
        async beforeUpdate(event) {
          const { params, state } = event;
          if (uid === 'api::recipe.recipe') {
            console.log('[MACRO-CALC-V5] beforeUpdate: High-stability recalculation starting');

            try {
              // 1. Fetch current data via simple id-based query to avoid complex joins/hangs
              const existing = await strapi.db.query('api::recipe.recipe').findOne({
                where: params.where,
                populate: {
                  ingredients: true,
                  macros: { select: ['id'] }
                }
              });

              if (!existing) return;

              const payload = { ...params.data };

              // Only use existing ingredients if the update payload doesn't contain them
              if (!payload.ingredients && existing.ingredients) {
                payload.ingredients = existing.ingredients;
                console.log(`[MACRO-CALC-V5] Re-using ${existing.ingredients.length} existing ingredients`);
              } else if (payload.ingredients && Array.isArray(payload.ingredients) && existing.ingredients) {
                // Merge partial updates with existing ingredients to ensure we have all fields for calculation
                payload.ingredients = payload.ingredients.map((incomingIng: any) => {
                  if (incomingIng.id) {
                    const existingIng = existing.ingredients.find((ei: any) => ei.id === incomingIng.id);
                    if (existingIng) {
                      return { ...existingIng, ...incomingIng };
                    }
                  }
                  return incomingIng;
                });
                console.log(`[MACRO-CALC-V5] Merged ${payload.ingredients.length} ingredients from payload with existing data`);
              }

              if (payload.ingredients && Array.isArray(payload.ingredients)) {
                const calculated = await calculateRecipeMacros(payload);
                if (calculated) {
                  // Set values directly on params.data
                  params.data.kcal = calculated.kcal;
                  state.calculatedMacros = calculated.macros;

                  if (existing.macros?.id) {
                    state.existingMacrosId = existing.macros.id;
                    // Delete macros from payload to prevent EntityManager from overwriting with frontend 0s
                    delete params.data.macros;
                    console.log(`[MACRO-CALC-V5] Scheduled forceful update for macros ID: ${existing.macros.id}`);
                  } else {
                    params.data.macros = calculated.macros;
                    console.log('[MACRO-CALC-V5] Creating new macros component attached to params');
                  }
                }
              }
            } catch (err) {
              console.error('[MACRO-CALC-V5] CRITICAL Hook failure:', err);
              // We do NOT throw here because we don't want to block the whole CMS if calculation fails
            }
          }
        },
        async afterCreate(event) {
          const { result, state } = event;
          let entityToSync = result;
          try {
            const docId = (result as any).documentId || (result as any).id;
            // Fetch fully populated entity to ensure relations (like assignedProfiles) are arrays, not { count: X }
            const populated = await strapi.documents(uid as any).findOne({
              documentId: docId,
              populate: '*',
            });
            if (populated) {
              entityToSync = populated;
              // If we calculated macros on creation, force inject them for Firebase!
              if (uid === 'api::recipe.recipe' && state.calculatedMacros) {
                (entityToSync as any).macros = state.calculatedMacros;
                (entityToSync as any).kcal = (state.calculatedMacros as any).kcal || (result as any).kcal;
              }
            }
          } catch (e) {
            console.error(`[FIREBASE] Failed to populate ${uid} for full sync:`, e);
          }
          await syncToFirestore(uid, entityToSync, 'create');
        },
        async afterUpdate(event) {
          const { result, state } = event;

          if (uid === 'api::recipe.recipe' && state.calculatedMacros) {
            try {
              let macrosId = state.existingMacrosId;
              if (!macrosId && (result as any).macros?.id) {
                macrosId = (result as any).macros.id;
              }

              if (macrosId) {
                await strapi.db.query('shared.macros').update({
                  where: { id: macrosId },
                  data: state.calculatedMacros
                });
                console.log('[MACRO-CALC-V5] Forcefully updated shared.macros in DB');
              }
            } catch (e) {
              console.error('[MACRO-CALC-V5] Error forceful DB update for macros:', e);
            }

            // Inject correct macros into result for Firebase sync!
            (result as any).macros = state.calculatedMacros;
          }

          let entityToSync = result;
          try {
            const docId = (result as any).documentId || (result as any).id;
            // Fetch fully populated entity to ensure relations (like assignedProfiles) are arrays, not { count: X }
            const populated = await strapi.documents(uid as any).findOne({
              documentId: docId,
              populate: '*',
            });
            // Protect manually calculated macros on recipes, otherwise use populated
            if (populated) {
              entityToSync = populated;
              // If we just calculated fresh macros for this update, push them to Firebase overriding DB state
              if (uid === 'api::recipe.recipe' && state.calculatedMacros) {
                (entityToSync as any).macros = state.calculatedMacros;
                (entityToSync as any).kcal = (state.calculatedMacros as any).kcal || (result as any).kcal;
              }
            }
          } catch (e) {
            console.error(`[FIREBASE] Failed to populate ${uid} for full sync:`, e);
          }

          await syncToFirestore(uid, entityToSync, 'update');
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


