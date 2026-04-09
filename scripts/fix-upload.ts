import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

const STRAPI_URL = process.env.STRAPI_URL;
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

async function uploadToStrapi(recipeData: any) {
    const VALID_UNITS = ['g', 'ml', 'szt', 'lyzka', 'lyzeczka', 'szklanka', 'szczypta', 'plaster', 'garstka', 'opakowanie'];

    // Sanitize
    delete recipeData.optional;

    if (recipeData.ingredients) {
        recipeData.ingredients = recipeData.ingredients.map((ing: any) => {
            delete ing.optional;
            let u = ing.unit ? ing.unit.toLowerCase() : 'szt';
            if (!VALID_UNITS.includes(u)) {
                if (u === 'l') { u = 'ml'; ing.amount = (ing.amount || 0) * 1000; }
                else if (u === 'kg') { u = 'g'; ing.amount = (ing.amount || 0) * 1000; }
                else u = 'szt'; // Fallback to 'szt' 
            }
            return { ...ing, unit: u };
        });
    }

    const response = await axios.post(`${STRAPI_URL}/api/recipes`, {
        data: {
            ...recipeData,
            publishedAt: null
        }
    }, {
        headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }
    });
    return response.data;
}

const drafts = JSON.parse(fs.readFileSync(path.join(__dirname, 'draft-recipes.json'), 'utf8'));
const failedRecipe = drafts.find((r: any) => r.name.includes('Dyszone żeberka') || r.name.includes('żeberka') || r.name.includes('Zeberka'));

if (failedRecipe) {
    console.log(`Found failed recipe: ${failedRecipe.name}, uploading cleaned version...`);
    uploadToStrapi(failedRecipe)
        .then(res => console.log('Fixed upload SUCCESS: ID', res.data.id))
        .catch(err => console.error('Error:', err.response?.data || err.message));
} else {
    console.log('Failed recipe not found.');
}
