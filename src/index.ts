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
      // Add randomized jitter (0-5000ms) to stagger bulk requests
      const jitter = Math.floor(Math.random() * 5000);
      await new Promise(resolve => setTimeout(resolve, jitter));

      const collectionName = collectionsToSync[uid as keyof typeof collectionsToSync];
      if (!collectionName || !result) return;

      console.log(`[FIREBASE-DEBUG] >>> SYNCING: Action=${action}, UID=${uid}, Collection=${collectionName}`);

      // 1. Resolve ID
      let docId = result.documentId || result.document_id || (result.data?.document_id) || (result.data?.documentId);
      if (!docId && result.id) {
        try {
          const dbRow = await strapi.db.query(uid).findOne({ where: { id: result.id } });
          docId = dbRow?.documentId || dbRow?.document_id || String(result.id);
        } catch (e) {
          docId = String(result.id);
        }
      }

      if (!docId) {
        console.warn(`[FIREBASE-DEBUG] ERROR: No ID for ${uid}`);
        return;
      }

      try {
        if (action === 'delete' || action === 'unpublish') {
          await db.collection(collectionName).doc(docId).delete();
          console.log(`[FIREBASE-DEBUG] DELETED: ${collectionName}/${docId}`);
          return;
        }

        // 2. Resolve Full Data (Strapi 5 Document Service)

        const POPULATE_MAP: Record<string, string[]> = {
          'api::habit.habit': ['profiles', 'image'],
          'api::skin-care.skin-care': ['image'],
          'api::training.training': ['thumbnail'],
          'api::recipe.recipe': ['image', 'profiles'],
          'api::profile.profile': ['image']
        };

        const populateFields = POPULATE_MAP[uid] || ['image'];

        let dataToSync: any = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts && !dataToSync) {
          attempts++;
          try {
            if (attempts > 1) {
              const backoff = (attempts - 1) * 1000 + Math.floor(Math.random() * 500);
              console.log(`[FIREBASE-DEBUG] Retry attempt ${attempts}/${maxAttempts} for ${docId} after ${backoff}ms...`);
              await new Promise(r => setTimeout(r, backoff));
            }

            console.log(`[FIREBASE-DEBUG] REFETCHING ${uid}/${docId} (Populate: ${populateFields.join(',')})`);
            const fullDoc = await strapi.documents(uid as any).findOne({
              documentId: docId as string,
              populate: populateFields,
            });

            if (fullDoc) {
              dataToSync = { ...fullDoc };
              console.log(`[FIREBASE-DEBUG] DocService result keys:`, Object.keys(dataToSync).join(','));

              // Fallback for relations if still count objects (Strapi 5 quirk)
              const hasProfiles = 'profiles' in dataToSync;
              const isCount = hasProfiles && dataToSync.profiles?.count !== undefined;

              if (isCount) {
                console.log(`[FIREBASE-DEBUG] Profiles still unpopulated (count=${dataToSync.profiles.count}). Trying EntityService fallback...`);
                // @ts-ignore
                const entity = await strapi.entityService.findOne(uid, (fullDoc as any).id, {
                  populate: populateFields
                });
                if (entity) {
                  console.log(`[FIREBASE-DEBUG] EntityService fallback result!`);
                  dataToSync = { ...dataToSync, ...entity };
                }
              }
            } else {
              console.warn(`[FIREBASE-DEBUG] Document NOT FOUND: ${uid}/${docId}`);
              if (attempts === maxAttempts) dataToSync = { ...result };
            }
          } catch (e: any) {
            console.error(`[FIREBASE-DEBUG] Attempt ${attempts} failed for ${docId}:`, e.message);
            if (attempts === maxAttempts) {
              console.warn(`[FIREBASE-DEBUG] Max retries reached for ${docId}. Fallback to initial result.`);
              dataToSync = { ...result };
            }
          }
        }

        if (!dataToSync) return;

        // Flatten Data Wrappers 
        if (dataToSync.data) {
          dataToSync = { ...dataToSync, ...dataToSync.data };
          delete dataToSync.data;
        }
        if (dataToSync.attributes) {
          dataToSync = { ...dataToSync, ...dataToSync.attributes };
          delete dataToSync.attributes;
        }

        // Handle "entries" array IF present (common in some Strapi patterns)
        if (Array.isArray(dataToSync.entries) && dataToSync.entries.length > 0) {
          console.log(`[FIREBASE-DEBUG] Flattening entries[0] for ${docId}`);
          dataToSync = { ...dataToSync, ...dataToSync.entries[0] };
          delete dataToSync.entries;
        }

        // 3. Status check
        const isPublished = !!(
          dataToSync.publishedAt ||
          dataToSync.published_at ||
          dataToSync.status === 'published' ||
          action === 'publish'
        );

        if (isPublished) {
          // 4. Flatten Relations
          const handleRelations = (key: string, targetKey: string) => {
            const val = dataToSync[key];
            if (Array.isArray(val)) {
              dataToSync[targetKey] = val.map((p: any) => {
                const item = p.attributes || p;
                if (typeof item === 'string') return item;
                return item.slug || item.name || item.documentId || item.id || item;
              });
              if (key !== targetKey) delete dataToSync[key];
              console.log(`[FIREBASE-DEBUG] Mapped ${key} -> ${targetKey}:`, JSON.stringify(dataToSync[targetKey]));
            } else if (val && typeof val === 'object' && val.count !== undefined) {
              console.warn(`[FIREBASE-DEBUG] Relation "${key}" is still a COUNT object on ${docId}. DELETING.`);
              delete dataToSync[key];
              if (!dataToSync[targetKey]) dataToSync[targetKey] = [];
            }
          };

          handleRelations('profiles', 'assignedProfiles');
          handleRelations('assignedProfiles', 'assignedProfiles');
          handleRelations('phases', 'assignedPhases');
          handleRelations('assignedPhases', 'assignedPhases');

          // Ensure backward compatibility and secondary keys
          if (dataToSync.assignedPhase && !dataToSync.assignedPhases) {
            dataToSync.assignedPhases = [dataToSync.assignedPhase];
          }
          if (dataToSync.assignedProfile && !dataToSync.assignedProfiles) {
            dataToSync.assignedProfiles = [dataToSync.assignedProfile];
          }

          // 5. Cleanup
          const junk = ['id', 'documentId', 'document_id', 'createdBy', 'updatedBy', 'publishedAt', 'published_at', 'status', 'locale', 'localizations'];
          junk.forEach(f => delete dataToSync[f]);

          dataToSync.updatedAt = new Date().toISOString();
          dataToSync.source = 'strapi';

          console.log(`[FIREBASE-DEBUG] SENDING to ${collectionName}/${docId}:`, Object.keys(dataToSync).join(', '));
          await db.collection(collectionName).doc(docId).set(dataToSync, { merge: true });
        } else {
          console.log(`[FIREBASE-DEBUG] IGNORED (Draft): ${docId}`);
        }
      } catch (error) {
        console.error(`[FIREBASE-DEBUG] SYNC ERROR:`, error);
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
                // We sync the final result after it's been processed
                await syncToFirestore(uid, result, action);
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
