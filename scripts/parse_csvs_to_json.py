import csv
import json
import re
import os

# Slowniki i tlumaczenia
def normalize_ingredient_name(raw_name):
    if not raw_name: return ''
    name = raw_name.lower().strip()
    name = re.sub(r'\\(.*?\\)', '', name).strip()

    dictionary = {
        'jajka': 'jajko',
        'jajo': 'jajko',
        'jajko kurze': 'jajko',
        'jajka kurze': 'jajko',
        'pomidory': 'pomidor czerwony',
        'pomidor': 'pomidor czerwony',
        'pomidorki': 'pomidory koktajlowe',
        'pomidorek': 'pomidory koktajlowe',
        'pieczarki': 'pieczarki',
        'oliwa': 'oliwa z oliwek',
        'oliwa extra virgin': 'oliwa z oliwek',
        'pieprz': 'pieprz czarny',
        'pieprz czarny mielony': 'pieprz czarny',
        'śmietana': 'śmietana 18%',
        'sól': 'sól',
        'sól morska': 'sól'
    }

    if name in dictionary:
        return dictionary[name]

    name = re.sub(r'\\s+', ' ', name)
    if len(name) > 0:
        return name[0].upper() + name[1:]
    return name

def map_unit(raw_unit):
    u = raw_unit.lower().strip()
    if u in ('sztuka', 'sztuki', 'sztuk', 'duża sztuka', 'mała sztuka', 'średnia sztuka', 'puszka', 'duża puszka', 'mała puszka', 'kromka', 'kromki', 'porcja', 'miarka', 'pęczek', 'ząbek', 'kostka', 'liść', 'różyczka', 'torebka', 'ziarenko', 'kawałek'):
        return 'szt'
    if u in ('łyżka', 'łyżki', 'łyżek', 'łyzka'):
        return 'lyzka'
    if u in ('łyżeczka', 'łyżeczki', 'łyżeczek', '2 łyżeczki', '3 łyżeczki'):
        return 'lyzeczka'
    if u in ('g',):
        return 'g'
    if u in ('ml', 'kropla'):
        return 'ml'
    if u in ('szklanka', 'filiżanka'):
        return 'szklanka'
    if u in ('szczypta', 'szczypty'):
        return 'szczypta'
    if u in ('plaster', 'plastry', 'średni plaster'):
        return 'plaster'
    if u in ('garść', 'garście'):
        return 'garstka'
    if u in ('opakowanie', 'duże opakowanie', 'małe opakowanie', 'średnie opakowanie'):
        return 'opakowanie'
    return 'g'  # default fallback

# Mapping meal slots based on file origin to be safe, BUT the prompt states: 
# "druige sniadanie, przekaska" -> ["przekaska-1", "przekaska-2"]
# And we also need to respect the mealSlot column in the CSV if possible.
# Actually, the user confirmed: 1) same pool for snacks -> przekaska-1, przekaska-2.
def map_meal_slot(raw_slot):
    if not raw_slot: return ["sniadanie"] # fallback
    val = raw_slot.lower().strip()
    slots = []
    if 'sniadanie' in val and 'drugie' not in val: slots.append('sniadanie')
    if 'przekaska' in val or 'drugie śniadanie' in val or 'przekąska' in val:
        slots.extend(['przekaska-1', 'przekaska-2'])
    if 'obiad' in val: slots.append('obiad')
    if 'kolacja' in val: slots.append('kolacja')
    
    # Deduplicate
    return list(dict.fromkeys(slots))

def parse_ingredients(ing_raw):
    ingredients = []
    if not ing_raw: return ingredients
    
    # Check for colon format
    if ':' in ing_raw and '(' not in ing_raw:
        parts = ing_raw.split(',')
        for p in parts:
            p = p.strip()
            if ':' in p:
                name_part, amount_part = p.split(':', 1)
                name = normalize_ingredient_name(name_part)
                # primitive extraction of amount and unit
                # e.g. '2 sztuki' -> 2, 'sztuki'
                amount_part = amount_part.strip()
                m = re.match(r'^(\\d+\\.?\\d*)\\s*(.*)$', amount_part)
                if m:
                    amount = float(m.group(1))
                    unit = map_unit(m.group(2))
                else:
                    amount = 1.0
                    unit = map_unit(amount_part)
                
                ingredients.append({
                    "name": name,
                    "amount": amount,
                    "unit": unit
                })
        return ingredients

    # Standard format
    lines = ing_raw.split('\\n')
    merged = []
    for line in lines:
        line = line.strip()
        if not line: continue
        if re.match(r'^\\d+\\.?\\d*\\s*g?\\s*$', line):
            if merged: merged[-1] = merged[-1] + ' ' + line
            continue
        merged.append(line)
    
    for line in merged:
        m = re.search(r'\\(([^)]+)\\)', line)
        if m:
            inner = m.group(1).strip()
            parts = inner.split()
            amount = 1.0
            unit = 'g'
            if len(parts) >= 1:
                try:
                    amount = float(parts[0].replace(',', '.'))
                except:
                    pass
            if len(parts) >= 2:
                unit = map_unit(' '.join(parts[1:]))

            name = normalize_ingredient_name(line[:line.index('(')])
            ingredients.append({
                "name": name,
                "amount": amount,
                "unit": unit
            })
        else:
            # Bullet point format fallback
            clean = line.replace('•', '').strip()
            if clean:
                name = normalize_ingredient_name(clean)
                ingredients.append({
                    "name": name,
                    "amount": 1,
                    "unit": "szt"
                })

    return ingredients

def main():
    base_dir = '/Users/apple/.gemini/antigravity/scratch/OH'
    files = [
        'recipes  - I śniadanie.csv',
        'recipes  - przekąska.csv',
        'recipes  - Obiad.csv',
        'recipes  - Kolacja.csv'
    ]
    
    all_recipes = []
    id_counter = 1000

    for fname in files:
        fpath = os.path.join(base_dir, fname)
        if not os.path.exists(fpath): continue
        with open(fpath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                id_counter += 1
                name = row.get('name', '').strip()
                if not name: continue
                
                desc = row.get('description', '').strip()
                prep = row.get('preparation', '').strip()
                prepTime = row.get('prepTime', '').strip()
                try:
                    prepTime = int(prepTime)
                except:
                    prepTime = 15

                servings = row.get('servings', '').strip()
                try:
                    servings = int(servings)
                except:
                    servings = 1

                slots = map_meal_slot(row.get('mealSlot'))
                if not slots:
                    if 'śniadanie' in fname: slots = ['sniadanie']
                    elif 'przekąska' in fname: slots = ['przekaska-1', 'przekaska-2']
                    elif 'Obiad' in fname: slots = ['obiad']
                    elif 'Kolacja' in fname: slots = ['kolacja']
                
                tags_raw = row.get('tags', '')
                tags = [t.strip() for t in tags_raw.split(',') if t.strip()]

                ings = parse_ingredients(row.get('ingredients', ''))

                recipe = {
                    "name": name,
                    "description": desc,
                    "preparation": prep,
                    "prepTime": prepTime,
                    "servings": servings,
                    "mealSlot": slots,
                    "tags": tags,
                    "ingredients": ings
                    # Profiles left empty as requested
                }
                all_recipes.append(recipe)

    # Save to data directory
    out_dir = os.path.join(base_dir, 'cms', 'data')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'recipes.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(all_recipes, f, ensure_ascii=False, indent=2)
    
    print(f'Done. Parsed {len(all_recipes)} recipes into {out_path}')

if __name__ == '__main__':
    main()
