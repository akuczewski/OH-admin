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

UNIT_MAP = {
    'g': 'g',
    'ml': 'ml',
    'szt': 'szt',
    'sztuka': 'szt',
    'sztuki': 'szt',
    'porcja': 'szt',
    'lyzka': 'lyzka',
    'łyżka': 'lyzka',
    'łyżek': 'lyzka',
    'łyżki': 'lyzka',
    'lyzeczka': 'lyzeczka',
    'łyżeczka': 'lyzeczka',
    'łyżeczek': 'lyzeczka',
    'łyżeczki': 'lyzeczka',
    'szklanka': 'szklanka',
    'szklanki': 'szklanka',
    'szczypta': 'szczypta',
    'szczypty': 'szczypta',
    'plaster': 'plaster',
    'plastry': 'plaster',
    'garść': 'garstka',
    'garście': 'garstka',
    'garstka': 'garstka',
    'opakowanie': 'opakowanie',
    'opakowania': 'opakowanie'
}

def clean_ingredient(raw_line):
    # Handle colon style: "jajko: 2 sztuki"
    raw_line = raw_line.replace(':', ' - ')
    
    raw_line = raw_line.strip()
    if not raw_line or len(raw_line) < 2:
        return None

    name = raw_line
    amount = 1.0
    unit = 'g'

    # 1. Handle "Name (measure) - 100g" or "Name: 100g"
    if ' - ' in raw_line:
        parts = raw_line.split(' - ')
        name = parts[0].strip()
        amount_part = parts[1].strip()
        
        # Match number and unit
        match = re.search(r'([\d./]+)\s*([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)', amount_part)
        if match:
            amt_str = match.group(1)
            # Handle fractions like 1/2
            if '/' in amt_str:
                num, den = amt_str.split('/')
                amount = float(num) / float(den)
            else:
                amount = float(amt_str)
            
            unit_raw = match.group(2).lower()
            unit = UNIT_MAP.get(unit_raw, 'g')
    else:
        # 2. Handle "Name (100g)"
        match = re.search(r'(.*)\(([\d./]+)\s*([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)\)', name)
        if match:
            name = match.group(1).strip()
            amt_str = match.group(2)
            if '/' in amt_str:
                num, den = amt_str.split('/')
                amount = float(num) / float(den)
            else:
                amount = float(amt_str)
            unit_raw = match.group(3).lower()
            unit = UNIT_MAP.get(unit_raw, 'g')

    # Clean name from measure notes: "Płatki (6 łyżek)" -> "Płatki"
    name_clean = re.sub(r'\(.*\)', '', name).strip()
    name_clean = re.sub(r'\s*-?\s*$', '', name_clean) 
    
    if not name_clean:
        return None

    return {
        'name': name_clean,
        'originalName': name,
        'amount': amount,
        'unit': unit
    }

def split_ingredients(raw_text):
    # Split by newline first
    lines = raw_text.split('\n')
    
    processed_lines = []
    for l in lines:
        l = l.strip()
        if not l: continue
        
        # Check if this line is a comma-separated list of ingredients
        # Pattern: "Name: 1, Name: 2" OR "Name (1), Name (2)"
        if (',' in l and (':' in l or '(' in l)) and not re.search(r'\d\s*g', l):
            # Potential comma list
            parts = [p.strip() for p in l.split(',')]
            processed_lines.extend(parts)
        else:
            processed_lines.append(l)

    # Join fragmented lines (e.g. name on one line, amount on next)
    true_lines = []
    for l in processed_lines:
        # If line starts with a digit or unit and we have a previous line, append it
        if true_lines and (re.match(r'^[\d./]', l) or l.lower() in UNIT_MAP or l.startswith('-')):
            true_lines[-1] = true_lines[-1] + ' ' + l
        else:
            true_lines.append(l)
            
    return true_lines

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
                # Split ingredients using the robust logic
                lines = split_ingredients(raw_ing)
                
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
