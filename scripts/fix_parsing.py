import csv
import json
import os
import re

# Common Polish ingredient declension mapping
NORMALIZE_MAP = {
    'oliwy': 'Oliwa',
    'oleju': 'Olej',
    'jogurtu': 'Jogurt',
    'cukru': 'Cukier',
    'masła': 'Masło',
    'mąki': 'Mąka',
    'soli': 'Sól',
    'pieprzu': 'Pieprz',
    'wody': 'Woda',
    'mleka': 'Mleko',
    'sera': 'Ser',
    'twarogu': 'Twaróg',
    'miodu': 'Miód',
    'soku': 'Sok',
    'cytryny': 'Cytryna',
    'jajka': 'Jajko',
    'jajek': 'Jajko',
    'piersi': 'Pierś',
    'mięsa': 'Mięso',
    'pomidora': 'Pomidor',
    'pomidorów': 'Pomidor',
    'ogórka': 'Ogórek',
    'ogórków': 'Ogórek',
    'cebuli': 'Cebula',
    'czosnku': 'Czosnek',
    'makaronu': 'Makaron',
    'ryżu': 'Ryż',
    'kaszy': 'Kasza',
    'owsianki': 'Owsianka',
    'płatków': 'Płatki',
    'orzechów': 'Orzechy',
    'owoców': 'Owoce',
    'warzyw': 'Warzywa',
}

def normalize_ingredient_name(name):
    name = name.strip()
    if not name: return name
    
    # Strip trailing colons or partial punctuation often left by "headers"
    name = re.sub(r'[:;.-]$', '', name).strip()

    # Try to normalize words
    words = name.split()
    normalized_words = []
    for w in words:
        w_low = w.lower().rstrip(',.')
        if w_low in NORMALIZE_MAP:
            normalized_words.append(NORMALIZE_MAP[w_low])
        else:
            normalized_words.append(w)
    
    result = " ".join(normalized_words)
    # Capitalize first letter
    if result:
        result = result[0].upper() + result[1:]
    return result

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
    'kromka': 'szt',
    'kromki': 'szt',
    'kromek': 'szt',
    'ząbek': 'szt',
    'ząbki': 'szt',
    'ząbków': 'szt',
    'plaster': 'plaster',
    'plasterek': 'plaster',
    'plastry': 'plaster',
    'plasterków': 'plaster',
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
    'garść': 'garstka',
    'garście': 'garstka',
    'garstka': 'garstka',
    'opakowanie': 'opakowanie',
    'opakowania': 'opakowanie'
}

def parse_float(s):
    if not s: return 0.0
    s = s.replace(',', '.').strip()
    if '/' in s:
        try:
            num, den = s.split('/')
            return float(num) / float(den)
        except:
            return 1.0
    try:
        return float(s)
    except:
        return 1.0

def clean_ingredient(raw_line):
    # Normalize dash types
    raw_line = raw_line.replace('–', '-').replace('—', '-').strip()
    
    if not raw_line or len(raw_line) < 2:
        return None

    # Strip trailing junk
    raw_line = re.sub(r'\s*-?\s*$', '', raw_line)

    # If the whole line is in parentheses, strip them
    if raw_line.startswith('(') and raw_line.endswith(')'):
        raw_line = raw_line[1:-1].strip()

    name = raw_line
    amount = 1.0
    unit = 'szt'
    weight = 0.0

    # -- PRE-CLEAN: Handle double parentheses or comments --
    # "24 sztuki biszkoptów (ilość zależy od tego, jaką masz blaszkę)(100 g)"
    # Extract the weight if it's the last thing in parentheses
    match_weight = re.search(r'\(\s*([\d,./]+)\s*([gml]+)\s*\)$', raw_line, re.I)
    if match_weight:
        weight = parse_float(match_weight.group(1))
        raw_line = re.sub(r'\s*\(\s*[\d,./]+\s*[gml]+\s*\)$', '', raw_line, flags=re.I).strip()

    # -- RULE A: Name (Amount [Unit]) - Weight --
    match_a = re.search(r'^(.*?)\s*\(\s*([\d,./]+)\s*(?:.+?\s*)?([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)\s*\)\s*-\s*([\d,./]+)\s*([gml]+)', raw_line, re.I)
    if match_a:
        name = match_a.group(1).strip()
        amount = parse_float(match_a.group(2))
        unit = UNIT_MAP.get(match_a.group(3).lower(), 'szt')
        weight = parse_float(match_a.group(4))
        return { 'name': normalize_ingredient_name(name), 'amount': amount, 'unit': unit, 'weight': weight, 'originalName': raw_line }

    # -- RULE B: [Count] [Unit] [Name] [Weight] [Unit2] [Multiplier] --
    match_b = re.search(r'^(?:([\d,./]+)\s+)?([a-zA-Ząćęłńóśźż]+)\s+(.+?)\s+([\d,./]+)\s+([gml]+)(?:\s+([\d,./]+))?$', raw_line, re.I)
    if match_b:
        amount = parse_float(match_b.group(6)) if match_b.group(6) else parse_float(match_b.group(1)) or 1.0
        name = match_b.group(3).strip()
        unit = UNIT_MAP.get(match_b.group(2).lower(), 'szt')
        weight = parse_float(match_b.group(4))
        return { 'name': normalize_ingredient_name(name), 'amount': amount, 'unit': unit, 'weight': weight, 'originalName': raw_line }

    # -- RULE C: Simple Dash with Weight --
    if ' - ' in raw_line or raw_line.endswith('g') or raw_line.endswith('ml'):
        parts = raw_line.split(' - ')
        name_part = parts[0].strip()
        amount_part = parts[1].strip() if len(parts) > 1 else name_part
        
        match_c = re.search(r'([\d,./]+)\s*([gml]+)', amount_part, re.I)
        if match_c:
            weight = parse_float(match_c.group(1))
            name = re.sub(r'\s*-?\s*[\d,./]+\s*[gml]+$', '', name_part, flags=re.I).strip()
            return { 'name': normalize_ingredient_name(name), 'amount': weight, 'unit': 'g', 'weight': weight, 'originalName': raw_line }

    # -- RULE D: Colon Style --
    if ':' in raw_line:
        parts = raw_line.split(':')
        name = parts[0].strip()
        amt_match = re.search(r'([\d,./]+)\s*([a-zA-Ząćęłńóśźż]+)', parts[1], re.I)
        if amt_match:
            amount = parse_float(amt_match.group(1))
            unit = UNIT_MAP.get(amt_match.group(2).lower(), 'szt')
            return { 'name': normalize_ingredient_name(name), 'amount': amount, 'unit': unit, 'weight': weight, 'originalName': raw_line }

    # Fallback: Just the name but strip grammage and parenthetical comments
    clean_name = re.sub(r'\s*\(\s*.*?\s*\)', '', raw_line).strip()
    clean_name = re.sub(r'\s*-?\s*[\d,./]+\s*[gml]+$', '', clean_name, flags=re.I).strip()
    
    # -- FINAL SAFETY: Reject names that are just units or fragments --
    # Examples: "(5 łyżek)", "łyżka", "1 sztuka", "60 g,"
    norm_name = normalize_ingredient_name(clean_name)
    if not norm_name or len(norm_name) < 2:
        return None
    
    # regex matches things like "60 g", "10 ml", "1 szt", etc.
    is_pure_grammage = re.match(r'^[\d,./\s]+[a-zA-Ząćęłńóśźż]+,?\s*$', norm_name, re.I)

    # If the name itself is just a known unit type or a pure grammage, it's garbage
    if norm_name.lower() in UNIT_MAP or is_pure_grammage:
        # But allow it if it's a "real" food name (longer than 15 chars)
        if len(norm_name) < 15:
            return None

    return {
        'name': norm_name,
        'amount': amount,
        'unit': unit,
        'weight': weight,
        'originalName': raw_line
    }

def split_ingredients(raw_text):
    # 0. The "Blob Buster" - split before grammages in parentheses if they are followed by anything
    # Handles "...blaszkę)(100 g)" edge case by splitting between closed and open parens with grammage
    raw_text = re.sub(r'\)\s*(\(\s*[\d,./]+\s*[gml]+\s*\))', r')\n\1', raw_text, flags=re.I)
    raw_text = re.sub(r'(\([\d,./]+\s*[gml]+\))\s*', r'\1\n', raw_text)
    
    # Split before digits that look like new ingredient lines (e.g. "1 szklanka", "2 opakowania")
    # but NOT before "1." or "2." (steps) - we use positive lookahead
    raw_text = re.sub(r'(?<!\.)\s+(\d+\s+(?:szklanka|opakowanie|łyżka|łyżeczka|sztuka|g|ml))', r'\n\1', raw_text)

    # 1. Split by newline, semicolon, or bullet points
    parts = re.split(r'[\n;•*-]', raw_text)
    
    processed_lines = []
    for p in parts:
        p = p.strip()
        if not p: continue
        
        # 2. Heuristic for comma lists
        # Split if comma is followed by (optional space) and (digit OR known unit)
        comma_parts = re.split(r',(?=\s*[\d,./]+\s*[a-zA-Z]|\s*(?:szt|g|ml|łyż))', p, flags=re.I)
        if len(comma_parts) > 1:
            processed_lines.extend([cp.strip() for cp in comma_parts])
        else:
            processed_lines.append(p)

    # 3. Selective Join
    true_lines = []
    for l in processed_lines:
        l = l.strip()
        if not l: continue
        
        # Don't merge if it looks like a numbered step (e.g. "1.", "2.")
        is_step = re.match(r'^\d+\.', l)
        
        # Merge only if it's a "naked" grammage or unit continuation (e.g. "100g" on its own line)
        is_continuation = (re.match(r'^[\d,./]+\s*[gml]+$', l, re.I) or 
                           l.lower() in UNIT_MAP or 
                           (l.startswith('(') and l.endswith(')')))
        
        if true_lines and is_continuation and not is_step:
            separator = ' ' if not true_lines[-1].endswith('-') else ''
            true_lines[-1] = true_lines[-1] + separator + l
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
