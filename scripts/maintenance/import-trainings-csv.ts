/**
 * import-trainings-csv.ts
 * 
 * Imports training plans from CSV files into Strapi CMS using upsert logic.
 * Upsert = If a training with the same title already exists, update it.
 *          Otherwise, create a new one.
 * 
 * Usage:
 *   npx tsx cms/scripts/import-trainings-csv.ts
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

interface StrapiTraining {
    id: number;
    documentId: string;
    title: string;
}

async function fetchAllTrainings(): Promise<StrapiTraining[]> {
    console.log('[API] Fetching all existing trainings...');
    let allRecords: StrapiTraining[] = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
        try {
            const { data } = await api.get('/trainings', {
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

    console.log(`[API] Found ${allRecords.length} existing trainings in Strapi.`);
    return allRecords;
}

function findExisting(existingRecords: StrapiTraining[], title: string): StrapiTraining | null {
    const normalized = title.trim().toLowerCase();
    return existingRecords.find(t => t.title.trim().toLowerCase() === normalized) || null;
}

// ============================================================
// Upsert Logic
// ============================================================

interface TrainingPayload {
    title: string;
    description: string;
    duration: number | null;
    intensity: string;
    phases: string;
}

async function upsertTraining(
    existingRecords: StrapiTraining[],
    payload: TrainingPayload
): Promise<{ action: 'created' | 'updated' | 'skipped'; name: string }> {
    const existing = findExisting(existingRecords, payload.title);

    const body = {
        data: {
            title: payload.title,
            description: payload.description || undefined,
            duration: payload.duration,
            intensity: payload.intensity || undefined,
            phases: payload.phases,
            publishedAt: new Date().toISOString(),
        }
    };

    try {
        if (existing) {
            // UPDATE
            await api.put(`/trainings/${existing.documentId}`, body);
            return { action: 'updated', name: payload.title };
        } else {
            // CREATE
            const response = await api.post('/trainings', body);
            existingRecords.push({
                id: response.data.data.id,
                documentId: response.data.data.documentId,
                title: payload.title,
            });
            return { action: 'created', name: payload.title };
        }
    } catch (error: any) {
        console.error(`[ERROR] ${payload.title}`);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(`Message: ${error.message}`);
        }
        return { action: 'skipped', name: payload.title };
    }
}

// ============================================================
// Main
// ============================================================

const CSV_FILES = [
    { file: 'training - follicular.csv', defaultPhase: 'follicular' },
    { file: 'training - luteal.csv', defaultPhase: 'luteal' },
    { file: 'training - menstruation.csv', defaultPhase: 'menstruation' },
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    if (!STRAPI_API_TOKEN) {
        console.error('❌ STRAPI_API_TOKEN is missing in cms/.env');
        process.exit(1);
    }

    console.log('🚀 Starting training import...');
    console.log(`📡 Strapi URL: ${STRAPI_URL}`);

    // 1. Fetch all existing records
    const existingRecords = await fetchAllTrainings();

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
        console.log(`\n📂 Processing "${file}" — ${rows.length} trainings`);

        let rowCount = 0;
        for (const row of rows) {
            rowCount++;
            const title = row.title || '';
            if (!title || title.trim().length === 0) continue;

            console.log(`[PROGRESS] File: ${file}, Row: ${rowCount}/${rows.length}, Title: ${title}`);

            const duration = parseInt(row.duration, 10);
            
            const normalizeIntensity = (raw: string): string => {
                const cleaned = raw.trim().toLowerCase();
                if (cleaned === 'very low') return 'low';
                if (['low', 'medium', 'high'].includes(cleaned)) return cleaned;
                return 'medium'; // fallback
            };

            // Handle phases: Strapi 5 string workaround
            let phase = defaultPhase;
            if (row.phases) {
                const csvPhases = row.phases.split(',').map(p => p.trim().toLowerCase());
                if (csvPhases.length > 0 && csvPhases[0] !== '') {
                    phase = csvPhases[0];
                }
            }

            const payload: TrainingPayload = {
                title: title.trim(),
                description: (row.description || '').trim(),
                duration: isNaN(duration) ? null : duration,
                intensity: normalizeIntensity(row.intensity || ''),
                phases: phase,
            };

            const result = await upsertTraining(existingRecords, payload);
            stats[result.action]++;

            const icon = result.action === 'created' ? '✅' : result.action === 'updated' ? '🔄' : '⚠️';
            console.log(`  ${icon} ${result.action.toUpperCase()}: ${result.name}`);

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
