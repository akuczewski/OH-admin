import csv
import json
import os
import re

CSV_FILES = [
    { 'name': 'recipes  - I śniadanie.csv', 'slots': ['sniadanie'] },
    { 'name': 'recipes  - przekąska.csv', 'slots': ['przekaska-1', 'przekaska-2'] },
    { 'name': 'recipes  - Obiad.csv', 'slots': ['obiad'] },
    { 'name': 'recipes  - Kolacja.csv', 'slots': ['kolacja'] }
]

INPUT_DIR = '../OH'
OUTPUT_PATH = 'data/recipes.json'

def clean_ingredient(raw_line):
    raw_line = raw_line.strip()
    if not raw_line:
        return None

    name = raw_line
    amount = 1.0
    unit = 'szt'

    # Try to extract amount and unit from format: "Name (...) - 100g"
    if ' - ' in raw_line:
        parts = raw_line.split(' - ')
        name = parts[0].strip()
        amount_part = parts[1].strip()
        
        # Match number and unit (e.g. 100g, 50 ml, 1.5 szt)
        match = re.search(r'([\d.]+)\s*([a-zA-Z]+)', amount_part)
        if match:
            amount = float(match.group(1))
            unit = match.group(2)
    else:
        # Fallback for format: "Name (100g)"
        match = re.search(r'(.*)\(([\d.]+)\s*([a-zA-Z]+)\)', name)
        if match:
            name = match.group(1).strip()
            amount = float(match.group(2))
            unit = match.group(3)

    # Clean name from measure notes in brackets: "Płatki owsiane (6 łyżek)" -> "Płatki owsiane"
    name_clean = re.sub(r'\(.*\)', '', name).strip()
    
    return {
        'name': name_clean if name_clean else name,
        'originalName': name,
        'amount': amount,
        'unit': unit
    }

def main():
    all_recipes = []
    
    for file_def in CSV_FILES:
        path = os.path.join(INPUT_DIR, file_def['name'])
        if not os.path.exists(path):
            print(f"Warning: {path} not found.")
            continue
            
        print(f"Parsing {path}...")
        with open(path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Get raw ingredients string
                raw_ing = row.get('ingredients') or row.get('skladniki') or ''
                # Split by newline
                lines = raw_ing.split('\n')
                
                processed_ings = []
                for line in lines:
                    ing = clean_ingredient(line)
                    if ing:
                        processed_ings.append(ing)
                
                def safe_int(val, default=0):
                    try:
                        return int(float(val))
                    except (ValueError, TypeError):
                        return default

                recipe = {
                    'name': row.get('name') or row.get('Nazwa'),
                    'description': row.get('description') or row.get('Opis') or '',
                    'preparation': row.get('preparation') or row.get('Przygotowanie') or '',
                    'prepTime': safe_int(row.get('prepTime') or row.get('Czas')),
                    'servings': safe_int(row.get('servings') or row.get('Porcje'), 1),
                    'mealSlot': file_def['slots'],
                    'tags': [t.strip() for t in (row.get('tags') or '').split(',')] if row.get('tags') else [],
                    'ingredients': processed_ings
                }
                all_recipes.append(recipe)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(all_recipes, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully wrote {len(all_recipes)} recipes to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
