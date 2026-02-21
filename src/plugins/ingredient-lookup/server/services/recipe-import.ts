import { Core } from '@strapi/strapi';
import axios from 'axios';
import * as cheerio from 'cheerio';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
    async fetchAndParseRecipe(url: string) {
        try {
            console.log(`[RECIPE-IMPORTER] Fetching URL: ${url}`);

            // 1. Fetch raw HTML
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            const html = response.data;
            const $ = cheerio.load(html);

            // 2. Look for Schema.org Recipe JSON-LD
            let recipeData: any = null;

            $('script[type="application/ld+json"]').each((_, element) => {
                try {
                    const jsonContent = $(element).html() || '';
                    const parsed = JSON.parse(jsonContent);

                    // JSON-LD can be an array or a single object. Sometimes it is nested in @graph.
                    const arr = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);

                    for (const item of arr) {
                        if (item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))) {
                            recipeData = item;
                            break;
                        }
                    }
                } catch (e) {
                    // Ignore parse errors for individual blocks
                }
            });

            if (!recipeData) {
                // Fallback: Try to get basic OpenGraph tags if no Recipe schema exists
                const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text();
                const ogImage = $('meta[property="og:image"]').attr('content');
                if (!ogTitle) {
                    throw new Error('Nie znaleziono danych przepisu (Schema.org Recipe) pod tym adresem URL.');
                }

                recipeData = {
                    name: ogTitle,
                    image: ogImage ? [ogImage] : [],
                    recipeIngredient: []
                };
            }

            console.log(`[RECIPE-IMPORTER] Found recipe: ${recipeData.name}, parsed ${recipeData.recipeIngredient?.length || 0} raw ingredients.`);

            // 3. Map raw strings to OH ingredients format
            // In a real scenario we would do NLP or string matching against the 'ingredients' collection.
            // For now, we wrap the raw strings in our ingredient component structure.
            const mappedIngredients = (recipeData.recipeIngredient || []).map((rawStr: string) => {
                // Simple heuristic: Try to split amount/unit from name
                // "1 szklanka mąki" -> amount: "1", unit: "szklanka", name: "mąki"
                // For MVP, we'll store the raw string in description and put a placeholder name
                return {
                    name: rawStr, // the frontend or expert will fix mapping
                    amount: 1, // default
                    unit: 'g',
                    description: rawStr
                };
            });

            // 4. Create the Draft in Strapi Content-Manager
            const entryData = {
                name: recipeData.name,
                sourceUrl: url,
                servings: recipeData.recipeYield ? parseInt(String(recipeData.recipeYield)) : 1,
                prepTime: recipeData.prepTime || null,
                kcal: 0, // We'll let the user click 'Przelicz Makra' in the UI
                ingredients: mappedIngredients,
                // Add cover image URL as a simple text field if we want, or try to upload it 
                // but downloading & uploading files is complex. We will ignore images for now to ensure stability.
            };

            console.log('[RECIPE-IMPORTER] Creating draft in Strapi api::recipe.recipe...', entryData.name);

            // Note: Strapi 5 uses documentId for the Document Service API
            const createdDoc = await strapi.documents('api::recipe.recipe').create({
                data: entryData,
                status: 'draft'
            });

            return {
                documentId: createdDoc.documentId,
                title: createdDoc.name,
                ingredientsFound: mappedIngredients.length,
            };

        } catch (error: any) {
            console.error('[RECIPE-IMPORTER] Failed to fetch/parse:', error.message);
            throw error;
        }
    }
});
