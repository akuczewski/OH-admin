import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const CSV_FILES = [
    { name: 'recipes  - I śniadanie.csv', slots: ['sniadanie'] },
    { name: 'recipes  - przekąska.csv', slots: ['przekaska-1', 'przekaska-2'] },
    { name: 'recipes  - Obiad.csv', slots: ['obiad'] },
    { name: 'recipes  - Kolacja.csv', slots: ['kolacja'] }
];

const OUTPUT_PATH = path.resolve(process.cwd(), 'data/recipes.json');
const INPUT_DIR = path.resolve(process.cwd(), '../OH'); // Assuming CSVs are in OH folder based on grep

function cleanIngredient(rawLine: string) {
    // Expected formats: 
    // "Składnik (miara) - 100g"
    // "Składnik - 100g"
    // "Składnik (100g)"
    
    let name = rawLine.trim();
    let amount = 1;
    let unit = 'g';

    if (rawLine.includes(' - ')) {
        const parts = rawLine.split(' - ');
        name = parts[0].trim();
        const amountPart = parts[1].trim();
        
        // Match number and unit (e.g. 100g, 50 ml, 1.5 szt)
        const match = amountPart.match(/([\d.]+)\s*(\w+)/);
        if (match) {
            amount = parseFloat(match[1]);
            unit = match[2];
        }
    } else {
        // Fallback for strings without " - "
        const match = name.match(/(.*)\(([\d.]+)\s*(\w+)\)/);
        if (match) {
            name = match[1].trim();
            amount = parseFloat(match[2]);
            unit = match[3];
        }
    }

    // Secondary clean for name (remove measure notes in brackets if they exist)
    // "Płatki owsiane (6 łyżek)" -> "Płatki owsiane"
    const nameClean = name.replace(/\(.*\)/, '').trim();

    return { 
        name: nameClean || name, // Fallback to full name if cleaning wiped it
        originalName: name,
        amount, 
        unit 
    };
}

async function parseRecipes() {
    const allRecipes = [];

    for (const fileDef of CSV_FILES) {
        const filePath = path.join(INPUT_DIR, fileDef.name);
        if (!fs.existsSync(filePath)) {
            console.warn(`File not found: ${filePath}`);
            continue;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const records = parse(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        for (const row of records) {
            const rawIngredients = row.ingredients || row.skladniki || '';
            const lines = rawIngredients.split(/\n+/).filter((l: string) => l.trim().length > 0);
            
            const processedIngredients = lines.map(cleanIngredient);

            allRecipes.push({
                name: row.name || row.Nazwa,
                description: row.description || row.Opis || '',
                preparation: row.preparation || row.Przygotowanie || '',
                prepTime: parseInt(row.prepTime || row.Czas || '0'),
                servings: parseInt(row.servings || row.Porcje || '1'),
                mealSlot: fileDef.slots,
                tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
                ingredients: processedIngredients
            });
        }
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allRecipes, null, 2));
    console.log(`Successfully parsed ${allRecipes.length} recipes to ${OUTPUT_PATH}`);
}

parseRecipes().catch(console.error);
