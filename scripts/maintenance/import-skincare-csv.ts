/**
 * import-skincare-csv.ts
 * 
 * Imports skincare rituals from CSV files into Strapi CMS using upsert logic.
 * Upsert = If a ritual with the same name already exists, update it.
 *          Otherwise, create a new one.
 * 
 * Usage:
 *   npx tsx cms/scripts/import-skincare-csv.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import axios from 'axios';
import fs from 'fs';

const STRAPI_URL = process.env.STRAPI_URL || 'https://useful-sparkle-79935e08b6.strapiapp.com';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

const api = axios.create({
    baseURL: `${STRAPI_URL}/api`,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
});

// ============================================================
// CSV Parser (handles multiline quoted fields)
// ============================================================

interface CsvRow {
    [key: string]: string;
}

function parseCSV(content: string): CsvRow[] {
    const rows: CsvRow[] = [];
    const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    let headers: string[] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let isFirstRow = true;

    for (let i = 0; i < lines.length; i++) {
        const char = lines[i];

        if (char === '"') {
            if (inQuotes && i + 1 < lines.length && lines[i + 1] === '"') {
                currentField += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentField.trim());
            currentField = '';
        } else if (char === '\n' && !inQuotes) {
            currentRow.push(currentField.trim());
            currentField = '';

            if (isFirstRow) {
                headers = currentRow.map(h => h.toLowerCase().trim());
                isFirstRow = false;
            } else if (currentRow.some(f => f.length > 0)) {
                const row: CsvRow = {};
                for (let j = 0; j < headers.length; j++) {
                    row[headers[j]] = currentRow[j] || '';
                }
                rows.push(row);
            }
            currentRow = [];
        } else {
            currentField += char;
        }
    }

    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (!isFirstRow && currentRow.some(f => f.length > 0)) {
            const row: CsvRow = {};
            for (let j = 0; j < headers.length; j++) {
                row[headers[j]] = currentRow[j] || '';
            }
            rows.push(row);
        }
    }

    return rows;
}

// ============================================================
// Strapi API helpers
// ============================================================

interface StrapiSkinCare {
    id: number;
    documentId: string;
    name: string;
}

async function fetchAllSkinCares(): Promise<StrapiSkinCare[]> {
    console.log('[API] Fetching all existing skincare rituals...');
    let allRecords: StrapiSkinCare[] = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
        try {
            const { data } = await api.get('/skin-cares', {
                params: {
                    'pagination[page]': page,
                    'pagination[pageSize]': pageSize,
                    'status': 'published',
                }
            });

            allRecords = allRecords.concat(data.data);

            if (data.meta.pagination.page >= data.meta.pagination.pageCount) {
                break;
            }
            page++;
        } catch (error: any) {
            console.error('[API] Error fetching records:', error.message);
            break;
        }
    }

    console.log(`[API] Found ${allRecords.length} existing rituals in Strapi.`);
    return allRecords;
}

function findExisting(existingRecords: StrapiSkinCare[], name: string): StrapiSkinCare | null {
    const normalized = name.trim().toLowerCase();
    return existingRecords.find(h => h.name.trim().toLowerCase() === normalized) || null;
}

// ============================================================
// Upsert Logic
// ============================================================

interface SkinCarePayload {
    name: string;
    description: string;
    phases: string;
}

async function upsertSkinCare(
    existingRecords: StrapiSkinCare[],
    payload: SkinCarePayload
): Promise<{ action: 'created' | 'updated' | 'skipped'; name: string }> {
    const existing = findExisting(existingRecords, payload.name);

    const body = {
        data: {
            name: payload.name,
            description: payload.description || undefined,
            phases: payload.phases,
            publishedAt: new Date().toISOString(),
        }
    };

    try {
        if (existing) {
            // UPDATE
            await api.put(`/skin-cares/${existing.documentId}`, body);
            return { action: 'updated', name: payload.name };
        } else {
            // CREATE
            const response = await api.post('/skin-cares', body);
            existingRecords.push({
                id: response.data.data.id,
                documentId: response.data.data.documentId,
                name: payload.name,
            });
            return { action: 'created', name: payload.name };
        }
    } catch (error: any) {
        console.error(`[ERROR] ${payload.name}`);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(`Message: ${error.message}`);
        }
        return { action: 'skipped', name: payload.name };
    }
}

// ============================================================
// Main
// ============================================================

const CSV_FILES = [
    { file: 'skin-care - FOLLICULAR.csv', defaultPhase: 'follicular' },
    { file: 'skin-care - LUTEAL.csv', defaultPhase: 'luteal' },
    { file: 'skin-care - MENSTRUATION.csv', defaultPhase: 'menstruation' },
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    if (!STRAPI_API_TOKEN) {
        console.error('❌ STRAPI_API_TOKEN is missing in cms/.env');
        process.exit(1);
    }

    console.log('🚀 Starting skincare ritual import...');
    console.log(`📡 Strapi URL: ${STRAPI_URL}`);

    // 1. Fetch all existing records for upsert comparison
    const existingRecords = await fetchAllSkinCares();

    // 2. Process each CSV
    const stats = { created: 0, updated: 0, skipped: 0 };

    for (const { file, defaultPhase } of CSV_FILES) {
        const filePath = path.join(__dirname, '../../', file);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ File not found: ${filePath}`);
            continue;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const rows = parseCSV(content);
        console.log(`\n📂 Processing "${file}" — ${rows.length} rituals`);

        let rowCount = 0;
        for (const row of rows) {
            rowCount++;
            const name = row.name || '';
            if (!name || name.trim().length === 0) continue;

            console.log(`[PROGRESS] File: ${file}, Row: ${rowCount}/${rows.length}, Name: ${name}`);

            // Handle phases: Strapi 5 seems to expect a string even if multiple: true is in schema
            let phase = defaultPhase;
            if (row.phases) {
                const csvPhases = row.phases.split(',').map(p => p.trim().toLowerCase());
                if (csvPhases.length > 0 && csvPhases[0] !== '') {
                    phase = csvPhases[0]; // Take the first one
                }
            }

            const payload: SkinCarePayload = {
                name: name.trim(),
                description: (row.tip || '').trim(),
                phases: phase,
            };

            const result = await upsertSkinCare(existingRecords, payload);
            stats[result.action]++;

            const icon = result.action === 'created' ? '✅' : result.action === 'updated' ? '🔄' : '⚠️';
            console.log(`  ${icon} ${result.action.toUpperCase()}: ${result.name}`);

            // Rate limit: 200ms between requests
            await sleep(200);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Import Summary:');
    console.log(`  ✅ Created: ${stats.created}`);
    console.log(`  🔄 Updated: ${stats.updated}`);
    console.log(`  ⚠️  Skipped: ${stats.skipped}`);
    console.log(`  📦 Total:   ${stats.created + stats.updated + stats.skipped}`);
    console.log('='.repeat(60));
    console.log('🎉 Done!');
}

main().catch(console.error);
