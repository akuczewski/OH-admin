
import axios from 'axios';
import admin from 'firebase-admin';
import { convert } from 'html-to-text';
import OpenAI from 'openai';

export default ({ strapi }: { strapi: any }) => ({
    async importFromUrl(url: string) {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // 1. Fetch and clean content
        console.log(`[PLUGIN-IMPORT] Fetching: ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 15000
        });

        const content = convert(response.data, {
            wordwrap: 130,
            selectors: [
                { selector: 'a', options: { ignoreHref: true } },
                { selector: 'img', format: 'skip' },
                { selector: 'nav', format: 'skip' },
                { selector: 'footer', format: 'skip' },
                { selector: 'header', format: 'skip' },
                { selector: 'script', format: 'skip' },
                { selector: 'style', format: 'skip' },
                { selector: 'aside', format: 'skip' }
            ]
        });

        // 2. Get Ingredient Library (mapped from script logic)
        const db = admin.firestore();
        const snapshot = await db.collection('ingredients').get();
        const library = snapshot.docs.map(doc => ({
            name: doc.data().name,
            slug: doc.id
        }));

        const libraryText = library.map(ing => ing.name).join(', ');

        // 3. AI Parsing
        const prompt = `
Jesteś ekspertem dietetykiem OH! Club. Twoim zadaniem jest przetworzenie podanego przepisu na ustrukturyzowany format JSON zgodny z naszym systemem.

Dostępna baza składników:
${libraryText}

Instrukcje:
1. Rozpoznaj składniki i dopasuj do bazy. Wybierz NAJBARDZIEJ PASUJĄCĄ nazwę z listy.
2. Oblicz makroskładniki (kcal, białko, węgle, tłuszcz, błonnik) dla CAŁEGO przepisu.
3. Jednostki: g, ml, szt, lyzka, lyzeczka, szklanka, szczypta, plaster, garstka, opakowanie.
4. Przygotowanie: Markdown string.
5. MealSlot: sniadanie, sniadanie-2, obiad, przekaska, kolacja.
6. Pobierz autora/bloga.

Format:
{
  "name": "...",
  "description": "...",
  "kcal": 450,
  "macros": { "protein": 20, "carbs": 50, "fat": 15, "fiber": 5 },
  "ingredients": [ { "name": "DOKŁADNA NAZWA Z LISTY", "amount": 100, "unit": "g" } ],
  "preparation": "...",
  "prepTime": 20,
  "servings": 1,
  "mealSlot": "...",
  "author": "..."
}

Przepis:
${content}
Źródło: ${url}
`;

        const aiResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Jesteś asystentem API zwracającym tylko czysty JSON. Używaj tylko nazw z dostarczonej listy." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const parsedData = JSON.parse(aiResponse.choices[0].message.content || '{}');

        // 4. Normalize and Create Draft
        if (parsedData.ingredients) {
            parsedData.ingredients = parsedData.ingredients.map((ing: any) => {
                const found = library.find(l => l.name.toLowerCase() === ing.name.toLowerCase());
                return {
                    ...ing,
                    name: found ? found.slug : ing.name
                };
            });
        }

        // Map meal slots
        const slotMap: Record<string, string> = {
            'breakfast': 'sniadanie',
            'lunch': 'obiad',
            'dinner': 'kolacja',
            'snack': 'przekaska',
            'snack-2': 'sniadanie-2',
            'breakfast-2': 'sniadanie-2'
        };
        if (slotMap[parsedData.mealSlot?.toLowerCase()]) {
            parsedData.mealSlot = slotMap[parsedData.mealSlot.toLowerCase()];
        }

        // Use Strapi Document Service to create
        const entry = await strapi.documents('api::recipe.recipe').create({
            data: {
                ...parsedData,
                sourceUrl: url,
                publishedAt: null
            },
            status: 'draft'
        });

        return entry;
    },
});
