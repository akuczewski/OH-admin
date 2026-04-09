import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import axios from 'axios';
import fs from 'fs';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

async function uploadToStrapi(recipeData: any) {
    const VALID_UNITS = ['g', 'ml', 'szt', 'lyzka', 'lyzeczka', 'szklanka', 'szczypta', 'plaster', 'garstka', 'opakowanie'];
    const VALID_KEYS = ['name', 'description', 'kcal', 'macros', 'ingredients', 'preparation', 'prepTime', 'servings', 'mealSlot', 'tags', 'author', 'sourceUrl', 'publishedAt'];
    const cleanedRecipe: any = {};
    for (const k of Object.keys(recipeData)) {
        if (VALID_KEYS.includes(k)) {
            cleanedRecipe[k] = recipeData[k];
        }
    }

    if (cleanedRecipe.ingredients && Array.isArray(cleanedRecipe.ingredients)) {
        cleanedRecipe.ingredients = cleanedRecipe.ingredients.filter((ing: any) => typeof ing === 'object' && ing !== null && ing.name).map((ing: any) => {
            delete ing.optional;
            let u = ing.unit ? ing.unit.toLowerCase() : 'szt';
            if (!VALID_UNITS.includes(u)) {
                if (u === 'l') { u = 'ml'; ing.amount = (ing.amount || 0) * 1000; }
                else if (u === 'kg') { u = 'g'; ing.amount = (ing.amount || 0) * 1000; }
                else u = 'szt'; // Fallback to 'szt' for 'ząbek', 'pęczek', etc
            }
            return { name: ing.name, amount: ing.amount || 1, unit: u };
        });
    }

    try {
        const response = await axios.post(`${STRAPI_URL}/api/recipes`, {
            data: {
                ...cleanedRecipe,
                publishedAt: null // Explicitly as draft
            }
        }, {
            headers: {
                Authorization: `Bearer ${STRAPI_API_TOKEN}`
            }
        });
        return response.data;
    } catch (error: any) {
        if (error.response) {
            console.error('[STRAPI] Error details:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('[STRAPI] Error:', error.message);
        }
        throw error;
    }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    if (!STRAPI_API_TOKEN) {
        console.error('STRAPI_API_TOKEN is missing in .env');
        process.exit(1);
    }

    const draftsPath = path.join(__dirname, 'draft-recipes.json');
    if (!fs.existsSync(draftsPath)) {
        console.error(`File not found: ${draftsPath}`);
        process.exit(1);
    }

    console.log(`[UPLOAD] Reading ${draftsPath}...`);
    const drafts = JSON.parse(fs.readFileSync(draftsPath, 'utf8'));
    console.log(`[UPLOAD] Found ${drafts.length} recipes to upload.`);

    for (const recipe of drafts) {
        console.log(`[UPLOAD] Uploading: ${recipe.name}...`);
        try {
            const result = await uploadToStrapi(recipe);
            console.log(`[SUCCESS] DRAFT Created: ${recipe.name} (ID: ${result.data.id})`);
        } catch (error) {
            console.error(`[FAILED] Failed to upload ${recipe.name}.`);
        }
        await sleep(1000); // 1s delay to be safe
    }

    console.log('[UPLOAD] Finished all uploads!');
}

main().catch(console.error);
