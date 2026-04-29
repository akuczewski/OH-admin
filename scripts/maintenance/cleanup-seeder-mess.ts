
import axios from 'axios';

const STRAPI_URL = process.env.STRAPI_URL || 'https://useful-sparkle-79935e08b6.strapiapp.com';
const STRAPI_TOKEN = process.env.EXPO_PUBLIC_STRAPI_TOKEN;

const DRY_RUN = process.argv.includes('--dry-run');

// Seeder ran on Monday 2026-04-28 at 16:53:51 UTC.
// Recipes added before that are legitimate (expert-added).
const SEEDER_START = '2026-04-28T16:53:00.000Z';
const SEEDER_END   = '2026-04-28T23:59:59.999Z';

const api = axios.create({
  baseURL: STRAPI_URL,
  headers: {
    Authorization: `Bearer ${STRAPI_TOKEN}`,
  },
  timeout: 30000,
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchSeederRecipes(): Promise<any[]> {
  let all: any[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const res = await api.get('/api/recipes', {
      params: {
        'filters[createdAt][$gte]': SEEDER_START,
        'filters[createdAt][$lte]': SEEDER_END,
        'pagination[page]': page,
        'pagination[pageSize]': pageSize,
        'fields[0]': 'documentId',
        'fields[1]': 'name',
        'fields[2]': 'createdAt',
      }
    });
    const items = res.data.data || [];
    all = all.concat(items);
    console.log(`  Page ${page}: fetched ${items.length} items (total so far: ${all.length})`);
    if (res.data.meta.pagination.page >= res.data.meta.pagination.pageCount) break;
    page++;
  }
  return all;
}

async function cleanup() {
  console.log('='.repeat(60));
  console.log('[CLEANUP] Seeder recipe recovery');
  console.log(DRY_RUN ? '⚠️  DRY RUN — no deletions will be performed' : '🔥 LIVE MODE — will DELETE records');
  console.log(`Seeder window: ${SEEDER_START} → ${SEEDER_END}`);
  console.log('='.repeat(60) + '\n');

  if (!STRAPI_TOKEN) {
    console.error('❌ EXPO_PUBLIC_STRAPI_TOKEN is not set');
    process.exit(1);
  }

  try {
    console.log('Scanning recipes created by seeder (after 16:53 on 2026-04-28)...');
    const recipesToDelete = await fetchSeederRecipes();

    console.log(`\n→ Found ${recipesToDelete.length} recipes:\n`);
    recipesToDelete.forEach((r: any) =>
      console.log(`  - "${r.name}" (${r.documentId}) — ${r.createdAt}`)
    );

    if (recipesToDelete.length === 0) {
      console.log('\n✅ Nothing to clean — no seeder recipes found.');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 ${recipesToDelete.length} recipes will be deleted`);
    console.log('='.repeat(60));

    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN finished. Re-run without --dry-run to perform deletion.');
      return;
    }

    console.log('\n[DELETING] Recipes...\n');
    let ok = 0, fail = 0;

    for (const recipe of recipesToDelete) {
      try {
        await api.delete(`/api/recipes/${recipe.documentId}`);
        console.log(`  ✅ "${recipe.name}" (${recipe.documentId})`);
        ok++;
      } catch (e: any) {
        console.error(`  ❌ "${recipe.name}": ${e.response?.data?.error?.message || e.message}`);
        fail++;
      }
      await sleep(200);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 DONE: ✅ ${ok} deleted  ❌ ${fail} failed`);
    console.log('Firebase: auto-cleaned via afterDelete lifecycle hook');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('[CLEANUP ERROR]', error.response?.data || error.message);
    process.exit(1);
  }
}

cleanup();
