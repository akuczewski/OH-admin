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
    console.log('##################################################');
    console.log('###  OH-ADMIN FIREBASE SYNC BOOTSTRAP STARTING ###');
    console.log('##################################################');

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

    const syncToFirestore = async (uid: string, result: any, action: string) => {
      const collectionName = collectionsToSync[uid as keyof typeof collectionsToSync];
      if (!collectionName || !result) return;

      console.log(`[FIREBASE-DEBUG] >>> TRACING SYNC: Action=${action}, UID=${uid}`);

      // Robust UUID (documentId) extraction for Strapi 5
      let docId = result.documentId || result.document_id;

      // If we only have a numeric ID, FETCH the document to get its UUID
      if (!docId && result.id) {
        try {
          const dbRow = await strapi.db.query(uid).findOne({ where: { id: result.id } });
          docId = dbRow?.documentId || dbRow?.document_id || String(result.id);
          console.log(`[FIREBASE-DEBUG] Resolved numeric ID ${result.id} to UUID: ${docId}`);
        } catch (e) {
          docId = String(result.id);
          console.warn(`[FIREBASE-DEBUG] Failed to resolve UUID for numeric ID ${result.id}, using numeric as fallback.`);
        }
      }

      if (!docId) {
        console.warn(`[FIREBASE-DEBUG] FAIL: No ID could be found for ${uid}. Keys: ${Object.keys(result).join(',')}`);
        return;
      }

      try {
        if (action === 'delete' || action === 'unpublish') {
          await db.collection(collectionName).doc(docId).delete();
          console.log(`[FIREBASE-DEBUG] SUCCESS: Deleted ${collectionName}/${docId}`);
          return;
        }

        // Detect if item is published
        const isPublished = !!(
          result.publishedAt ||
          result.published_at ||
          result.status === 'published' ||
          action === 'publish'
        );

        console.log(`[FIREBASE-DEBUG] Status check for ${docId}: isPublished=${isPublished}, action=${action}`);

        if (isPublished) {
          const dataToSync = { ...result };

          // Flatten relations for the mobile app
          const handleRelations = (key: string, targetKey: string) => {
            if (Array.isArray(dataToSync[key])) {
              dataToSync[targetKey] = dataToSync[key].map((p: any) =>
                typeof p === 'string' ? p : (p.slug || p.name || p.documentId || p.id || p)
              );
            }
          };

          handleRelations('profiles', 'assignedProfiles');
          handleRelations('assignedProfiles', 'assignedProfiles');
          handleRelations('phases', 'assignedPhases');
          handleRelations('assignedPhases', 'assignedPhases');

          if (dataToSync.assignedPhase && !dataToSync.assignedPhases) {
            dataToSync.assignedPhases = [dataToSync.assignedPhase];
          }

          // Cleanup Strapi fields to avoid pollution
          const junk = ['id', 'documentId', 'document_id', 'createdBy', 'updatedBy', 'publishedAt', 'published_at', 'status', 'locale', 'localizations'];
          junk.forEach(f => delete dataToSync[f]);

          dataToSync.updatedAt = new Date().toISOString();
          dataToSync.source = 'strapi';

          await db.collection(collectionName).doc(docId).set(dataToSync, { merge: true });
          console.log(`[FIREBASE-DEBUG] SUCCESS: Full sync completed for ${collectionName}/${docId}`);
        } else {
          console.log(`[FIREBASE-DEBUG] IGNORED: ${docId} is DRAFT.`);
        }
      } catch (error) {
        console.error(`[FIREBASE-DEBUG] CRITICAL ERROR for ${collectionName}/${docId}:`, error);
      }
    };

    // --- 4. Strapi 5 Document Service Middleware ---
    // @ts-ignore
    strapi.documents.use(async (context, next) => {
      const { uid, action, params } = context;
      const collectionName = collectionsToSync[uid as keyof typeof collectionsToSync];

      // A. Pre-operation (Recipe Macros)
      if (uid === 'api::recipe.recipe' && (action === 'create' || action === 'update')) {
        try {
          if (params.data?.ingredients) {
            const calculated = await calculateRecipeMacros(params.data);
            if (calculated) {
              params.data.kcal = calculated.kcal;
              params.data.macros = calculated.macros;
            }
          }
        } catch (err) { console.error('[FIREBASE-DEBUG] Macro calc error:', err); }
      }

      // B. Execute
      const result = await next();

      // C. Post-operation (Sync)
      if (collectionName) {
        (async () => {
          try {
            console.log(`[FIREBASE-DEBUG] Intercepted Document Action: ${action} for ${uid}`);

            if (action === 'delete' || action === 'unpublish') {
              const docId = (params as any).documentId || (result as any)?.documentId || (result as any)?.id;
              if (docId) await syncToFirestore(uid, { documentId: docId }, action);
              return;
            }

            if (['create', 'update', 'publish'].includes(action)) {
              const docId = (result as any)?.documentId || (params as any).documentId || (result as any)?.id;
              if (docId) {
                const populated = await strapi.documents(uid as any).findOne({
                  documentId: String(docId),
                  status: (action === 'publish' || (result as any)?.publishedAt || (result as any)?.status === 'published') ? 'published' : 'draft',
                  populate: '*'
                }).catch(() => null);

                await syncToFirestore(uid, populated || result, action);
              }
            }
          } catch (e) { console.error('[FIREBASE-DEBUG] Middleware post-hook error:', e); }
        })();
      }

      return result;
    });

    console.log('[FIREBASE] Document Service Middleware registered.');
  },
};
