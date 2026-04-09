/**
 * import-habits-csv.ts
 * 
 * Imports habits from CSV files into Strapi CMS using upsert logic.
 * Upsert = If a habit with the same name already exists for a given profile, update it.
 *          Otherwise, create a new one.
 * 
 * Usage:
 *   npx tsx cms/scripts/import-habits-csv.ts
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

    // Split into fields respecting quoted values
    let headers: string[] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let isFirstRow = true;

    for (let i = 0; i < lines.length; i++) {
        const char = lines[i];

        if (char === '"') {
            if (inQuotes && i + 1 < lines.length && lines[i + 1] === '"') {
                // Escaped quote
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
                headers = currentRow;
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

    // Handle last row
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
// Mapping & Normalization
// ============================================================

const VALID_CATEGORIES = ['zywienie', 'suplementacja', 'ruch', 'pielegnacja', 'mindfulness'];

function normalizeCategory(raw: string): string {
    const cleaned = raw.toLowerCase().trim();
    // Fix known typos
    if (cleaned === 'pielengacja') return 'pielegnacja';
    if (VALID_CATEGORIES.includes(cleaned)) return cleaned;
    // Default to zywienie since most habits are nutrition-based
    return 'zywienie';
}

function normalizeUnit(raw: string): string {
    const cleaned = raw.toLowerCase().trim();
    if (cleaned === 'licznik') return 'licznik';
    if (cleaned === 'minuty') return 'minuty';
    return 'tak-nie';
}

function normalizePriority(raw: string): number {
    const num = parseInt(raw, 10);
    return isNaN(num) ? 1 : num;
}

function normalizeDailyGoal(raw: string): number | null {
    const num = parseInt(raw, 10);
    return isNaN(num) ? null : num;
}

// ============================================================
// Strapi API helpers
// ============================================================

interface StrapiProfile {
    id: number;
    documentId: string;
    name: string;
    slug: string;
}

interface StrapiHabit {
    id: number;
    documentId: string;
    name: string;
    profiles?: { id: number; name: string }[];
}

let profileCache: StrapiProfile[] = [];

async function fetchProfiles(): Promise<StrapiProfile[]> {
    console.log('[API] Fetching profiles...');
    const { data } = await api.get('/profiles', {
        params: { 'pagination[pageSize]': 50, status: 'published' }
    });
    profileCache = data.data;
    console.log(`[API] Found ${profileCache.length} profiles:`, profileCache.map((p: StrapiProfile) => `${p.name} (${p.documentId})`).join(', '));
    return profileCache;
}

function findProfileId(csvProfileName: string): string | null {
    const normalized = csvProfileName.trim().toLowerCase();

    const PROFILE_MAP: Record<string, string> = {
        'glow up': 'glow-up',
        'opanuj cukier': 'opanuj-cukier',
        'opanuj skórę': 'opanuj-skore',
        'opanuj skore': 'opanuj-skore',
        'opanuj stres': 'opanuj-stres',
    };

    const slug = PROFILE_MAP[normalized];
    if (!slug) {
        console.warn(`[WARN] Unknown profile name: "${csvProfileName}"`);
        return null;
    }

    const profile = profileCache.find(p => p.slug === slug);
    if (!profile) {
        // Try matching by name instead
        const byName = profileCache.find(p =>
            p.name.toLowerCase().includes(normalized) || normalized.includes(p.name.toLowerCase())
        );
        if (byName) return byName.documentId;
        console.warn(`[WARN] Profile slug "${slug}" not found in Strapi`);
        return null;
    }
    return profile.documentId;
}

async function fetchAllHabits(): Promise<StrapiHabit[]> {
    console.log('[API] Fetching all existing habits...');
    let allHabits: StrapiHabit[] = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
        const { data } = await api.get('/habits', {
            params: {
                'pagination[page]': page,
                'pagination[pageSize]': pageSize,
                'populate': 'profiles',
                'status': 'published',
            }
        });

        allHabits = allHabits.concat(data.data);

        if (data.meta.pagination.page >= data.meta.pagination.pageCount) {
            break;
        }
        page++;
    }

    console.log(`[API] Found ${allHabits.length} existing habits in Strapi.`);
    return allHabits;
}

function findExistingHabit(existingHabits: StrapiHabit[], name: string): StrapiHabit | null {
    const normalized = name.trim().toLowerCase();
    return existingHabits.find(h => h.name.trim().toLowerCase() === normalized) || null;
}

// ============================================================
// Upsert Logic
// ============================================================

interface HabitPayload {
    name: string;
    description: string;
    content: string;
    category: string;
    type: string;
    unit: string;
    dailyGoal: number | null;
    priority: number;
    profiles: string[]; // documentIds
    publishedAt: string;
}

async function upsertHabit(
    existingHabits: StrapiHabit[],
    payload: HabitPayload
): Promise<{ action: 'created' | 'updated' | 'skipped'; name: string }> {
    const existing = findExistingHabit(existingHabits, payload.name);

    const body = {
        data: {
            name: payload.name,
            description: payload.description || undefined,
            content: payload.content || undefined,
            category: payload.category,
            type: payload.type,
            unit: payload.unit,
            dailyGoal: payload.dailyGoal,
            priority: payload.priority,
            profiles: payload.profiles.length > 0 ? payload.profiles : undefined,
            publishedAt: new Date().toISOString(),
        }
    };

    try {
        if (existing) {
            // UPDATE
            await api.put(`/habits/${existing.documentId}`, body);
            return { action: 'updated', name: payload.name };
        } else {
            // CREATE
            const response = await api.post('/habits', body);
            // Add to the list so we don't duplicate later
            existingHabits.push({
                id: response.data.data.id,
                documentId: response.data.data.documentId,
                name: payload.name,
            });
            return { action: 'created', name: payload.name };
        }
    } catch (error: any) {
        if (error.response) {
            console.error(`[ERROR] ${payload.name}:`, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(`[ERROR] ${payload.name}:`, error.message);
        }
        return { action: 'skipped', name: payload.name };
    }
}

// ============================================================
// Main
// ============================================================

const CSV_FILES = [
    { file: 'habits - GLOW UP.csv', profile: 'GLOW UP' },
    { file: 'habits - OPANUJ CUKIER .csv', profile: 'Opanuj Cukier' },
    { file: 'habits - OPANUJ SKÓRĘ.csv', profile: 'Opanuj Skórę' },
    { file: 'habits - OPANUJ STRES.csv', profile: 'Opanuj Stres' },
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    if (!STRAPI_API_TOKEN) {
        console.error('❌ STRAPI_API_TOKEN is missing in cms/.env');
        process.exit(1);
    }

    console.log('🚀 Starting habit import...');
    console.log(`📡 Strapi URL: ${STRAPI_URL}`);

    // 1. Fetch profiles
    await fetchProfiles();

    // 2. Fetch all existing habits for upsert comparison
    const existingHabits = await fetchAllHabits();

    // 3. Process each CSV
    const stats = { created: 0, updated: 0, skipped: 0 };

    for (const { file, profile } of CSV_FILES) {
        const filePath = path.join(__dirname, '../../', file);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ File not found: ${filePath}`);
            continue;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const rows = parseCSV(content);
        console.log(`\n📂 Processing "${file}" — ${rows.length} habits for profile "${profile}"`);

        const profileDocId = findProfileId(profile);
        if (!profileDocId) {
            console.error(`❌ Could not find profile "${profile}" in Strapi. Skipping file.`);
            continue;
        }

        for (const row of rows) {
            if (!row.name || row.name.trim().length === 0) continue;

            const payload: HabitPayload = {
                name: row.name.trim(),
                description: (row.description || '').trim(),
                content: (row.content || '').trim(),
                category: normalizeCategory(row.category || 'zywienie'),
                type: (row.type || 'program').trim().toLowerCase(),
                unit: normalizeUnit(row.unit || ''),
                dailyGoal: normalizeDailyGoal(row.dailyGoal || ''),
                priority: normalizePriority(row.priority || '1'),
                profiles: [profileDocId],
                publishedAt: new Date().toISOString(),
            };

            const result = await upsertHabit(existingHabits, payload);
            stats[result.action]++;

            const icon = result.action === 'created' ? '✅' : result.action === 'updated' ? '🔄' : '⚠️';
            console.log(`  ${icon} ${result.action.toUpperCase()}: ${result.name}`);

            // Rate limit: 500ms between requests
            await sleep(500);
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
