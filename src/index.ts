import type { Core } from '@strapi/strapi';
import fs from 'fs';
import path from 'path';
import { db } from './lib/firebase';

export default {
  register() { },

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
    const quotes = [
      { text: "Słuchaj swojego ciała. Czas menstruacji to czas regeneracji i wsłuchania się w intuicję.", author: "Mądrość Natury", assignedPhase: "menstrual" },
      { text: "Nowa energia! Faza pęcherzykowa to idealny moment na planowanie i nowe projekty.", author: "Hormonalny Balans", assignedPhase: "follicular" },
      { text: "Promieniejesz! Twoja pewność siebie i libido są teraz na najwyższym poziomie.", author: "Blask Owulacji", assignedPhase: "ovulation" },
      { text: "Zwolnij. Twoje ciało przygotowuje się do nowego cyklu. Bądź dla siebie wyrozumiała.", author: "Czuła Lutealna", assignedPhase: "luteal" },
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
