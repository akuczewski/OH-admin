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
    'pomidory': 'Pomidor',
    'ogórka': 'Ogórek',
    'ogórków': 'Ogórek',
    'ogórki': 'Ogórek',
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
    'ziemniaka': 'Ziemniak',
    'ziemniaków': 'Ziemniak',
    'ziemniaki': 'Ziemniak',
    'truskawki': 'Truskawka',
    'truskawek': 'Truskawka',
    'maliny': 'Malina',
    'malin': 'Malina',
    'borówki': 'Borówka',
    'borówek': 'Borówka',
    'orzechy': 'Orzechy',
    'pestki': 'Pestki',
    'nasiona': 'Nasiona',
}

def normalize_ingredient_name(name):
    name = name.strip()
    if not name: return name
    
    # 1. Fix broken words (e.g. "ows iana" -> "owsiana", "Jogur t" -> "Jogurt")
    name = re.sub(r'([a-zA-Ząćęłńóśźż])\s([a-z]{2,})\b', r'\1\2', name)

    # 2. Remove common unit prefixes left after splitting
    # e.g. "G, hummus" -> "hummus", "Ml, napój" -> "napój"
    prefix_pattern = r'^(?:[Gg]|[Mm]l|[Łł]yżka|[Łł]yżeczka|[Ss]zt|[Ss]ztuk|[Oo]pakowanie|[Pp]uszka|[Ss]zczypta)\s*,\s*'
    name = re.sub(prefix_pattern, '', name, flags=re.IGNORECASE)

    # 3. Strip trailing junk and unmatched parens
    name = re.sub(r'[:;.-]$', '', name).strip()
    name = re.sub(r'\s*\)\s*$', '', name).strip() # Remove "Szklanek)" trailing paren
    name = re.sub(r'^\s*\(\s*', '', name).strip() # Remove "(... " leading paren

    # 4. Remove leading quantities or artifacts
    name = re.sub(r'^\d+([.,/-]\d+)?\s*', '', name)
    
    # 5. Try to normalize words via map
    words = name.split()
    normalized_words = []
    for w in words:
        w_low = w.lower().rstrip(',.')
        if w_low in NORMALIZE_MAP:
            normalized_words.append(NORMALIZE_MAP[w_low])
        else:
            normalized_words.append(w)
    
    result = " ".join(normalized_words)
    # 6. Final cleanup: capitalized first letter and length check
    if result:
        result = result[0].upper() + result[1:]
    
    # If the result still looks like garbage (e.g. contains numbers or is too long), return minimal
    if len(result) > 50 or re.search(r'\d', result):
        # Allow numbers only if they are part of a product name (rare)
        # But for now, if it still has numbers, it's probably uncleaned quantity
        pass 

    return result.strip()

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
    # Normalize dash types and strip
    raw_line = raw_line.replace('–', '-').replace('—', '-').strip()
    
    if not raw_line or len(raw_line) < 2:
        return None

    # Strip trailing junk
    raw_line = re.sub(r'[:;.\s-]$', '', raw_line).strip()

    name = raw_line
    amount = 1.0
    unit = 'szt'
    weight = 0.0

    # 1. EXTRACT WEIGHT FROM LAST PARENTHESES: "(100 g)"
    match_weight = re.search(r'\(\s*([\d,./]+)\s*([gml]+)\s*\)$', name, re.I)
    if match_weight:
        weight = parse_float(match_weight.group(1))
        name = name[:match_weight.start()].strip()

    # 2. EXTRACT COMPLEX QUANTITY: "(0.5 puszka)", "(2 łyżki)", "(garść)"
    # We look for (amount unit) or (unit)
    match_quantity = re.search(r'\(\s*(?:([\d,./]+)\s*)?([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)\s*\)$', name, re.I)
    if match_quantity:
        u_candidate = match_quantity.group(2).lower()
        if u_candidate in UNIT_MAP:
            amount = parse_float(match_quantity.group(1)) if match_quantity.group(1) else 1.0
            unit = UNIT_MAP[u_candidate]
            name = name[:match_quantity.start()].strip()

    # 3. RULE A: Name (Amount [Unit]) - Weight
    # This is a common complex format
    match_a = re.search(r'^(.*?)\s*\(\s*([\d,./]+)\s*(?:.+?\s*)?([a-zA-Ząćęłńóśźż]+)\s*\)\s*-\s*([\d,./]+)\s*([gml]+)', name, re.I)
    if match_a:
        name = match_a.group(1).strip()
        amount = parse_float(match_a.group(2))
        unit = UNIT_MAP.get(match_a.group(3).lower(), 'szt')
        weight = parse_float(match_a.group(4))
    
    # 4. RULE B: [Count] [Unit] [Name] [Weight]
    # "2 łyżki masła orzechowego 100g"
    match_b = re.search(r'^(?:([\d,./]+)\s+)?([a-zA-Ząćęłńóśźż]{2,})\s+(.+?)\s+([\d,./]+)\s*([gml]+)', name, re.I)
    if match_b and match_b.group(2).lower() in UNIT_MAP:
        amount = parse_float(match_b.group(1)) or 1.0
        unit = UNIT_MAP[match_b.group(2).lower()]
        name = match_b.group(3).strip()
        weight = parse_float(match_b.group(4))

    # 5. AGGRESSIVE FALLBACK: Strip any remaining parentheses and grammar markers
    # This prevents "Fasola (2 łyżki)" from becoming a name
    name = re.sub(r'\s*\(\s*.*?\s*\)', '', name).strip()
    name = re.sub(r'[:;.-]$', '', name).strip()
    
    # Strip leading numbers if they look like quantities
    # "2 jajka" -> "jajka"
    match_leading = re.match(r'^([\d,./]+)\s+(.+)$', name)
    if match_leading:
        # Check if the next word is a unit
        words = match_leading.group(2).split()
        if words and words[0].lower() in UNIT_MAP:
            amount = parse_float(match_leading.group(1))
            unit = UNIT_MAP[words[0].lower()]
            name = " ".join(words[1:])
        elif len(match_leading.group(1)) < 5: # Just a stray number
            amount = parse_float(match_leading.group(1))
            name = match_leading.group(2)

    norm_name = normalize_ingredient_name(name)
    if not norm_name or len(norm_name) < 2:
        return None

    return {
        'name': norm_name,
        'amount': amount,
        'unit': unit,
        'weight': weight if weight > 0 else (amount * 1.0 if unit in ['g', 'ml'] else 0.0),
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
