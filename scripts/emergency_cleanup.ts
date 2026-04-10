import 'dotenv/config';

const STRAPI_URL = process.env.STRAPI_URL;
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

async function cleanup() {
    if (!STRAPI_URL || !STRAPI_TOKEN) {
        console.error('Missing env variables');
        return;
    }

    const headers = {
        'Authorization': `Bearer ${STRAPI_TOKEN}`,
        'Content-Type': 'application/json'
    };

    console.log('[CLEANUP] Fetching ingredients with category "Inne"...');
    
    let deletedCount = 0;
    while (true) {
        // Fetch 100 items at a time
        const res = await fetch(`${STRAPI_URL}/api/ingredient-catalogs?filters[category][$eq]=Inne&pagination[pageSize]=100`, { headers });
        const json: any = await res.json();
        
        if (!json.data || json.data.length === 0) {
            break;
        }

        console.log(`[CLEANUP] Deleting ${json.data.length} items...`);
        for (const item of json.data) {
            const delRes = await fetch(`${STRAPI_URL}/api/ingredient-catalogs/${item.documentId}`, {
                method: 'DELETE',
                headers
            });
            if (delRes.ok) {
                deletedCount++;
            } else {
                console.error(`[CLEANUP] Failed to delete ${item.documentId}`);
            }
        }
    }

    console.log(`[CLEANUP] Done. Total deleted: ${deletedCount}`);
}

cleanup().catch(console.error);
