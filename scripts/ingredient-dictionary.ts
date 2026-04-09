export function normalizeIngredientName(rawName: string): string {
    if (!rawName) return '';
    let name = rawName.toLowerCase().trim();
    
    // Remove bracketed text, like "(opcjonalnie)" or "(z puszki)"
    name = name.replace(/\\(.*?\\)/g, '').trim();

    // Common synonyms dictionary
    const dictionary: Record<string, string> = {
        'jajka': 'jajko',
        'jajo': 'jajko',
        'jajko kurze': 'jajko',
        'jajka kurze': 'jajko',
        'pomidory': 'pomidor czerwony',
        'pomidor': 'pomidor czerwony',
        'pomidorki': 'pomidory koktajlowe',
        'pomidorek': 'pomidory koktajlowe',
        'pieczarki': 'pieczarki',      // keep plural as firebase has it mostly
        'oliwa': 'oliwa z oliwek',
        'oliwa extra virgin': 'oliwa z oliwek',
        'pieprz': 'pieprz czarny',
        'pieprz czarny mielony': 'pieprz czarny',
        'śmietana': 'śmietana 18%',
        'sól': 'sól',
        'sól morska': 'sól'
    };

    if (dictionary[name]) {
        return dictionary[name];
    }

    // Normalize whitespaces
    name = name.replace(/\\s+/g, ' ');

    // Capitalize first letter
    if (name.length > 0) {
        return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return name;
}
