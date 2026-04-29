async function main() {
  const STRAPI_URL = 'https://useful-sparkle-79935e08b6.strapiapp.com';
  const TOKEN = process.env.EXPO_PUBLIC_STRAPI_TOKEN;
  
  if (!TOKEN) {
    console.error('❌ Missing EXPO_PUBLIC_STRAPI_TOKEN in environment');
    return;
  }

  console.log('🚀 Starting migration on: ' + STRAPI_URL);

  const SLOT_MAP = {
    'sniadanie': 'sniadanie',
    'sniadanie-2': 'sniadanie',
    'przekaska': 'przekaska',
    'przekaska-1': 'przekaska',
    'przekaska-2': 'przekaska',
    'obiad': 'obiad',
    'kolacja': 'kolacja',
  };

  try {
    const res = await fetch(`${STRAPI_URL}/api/recipes?pagination[pageSize]=100&fields[0]=documentId&fields[1]=name&fields[2]=mealSlots&fields[3]=mealSlot`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP error! status: ${res.status} - ${errText}`);
    }
    
    const data = await res.json();
    const recipes = data.data;
    console.log(`📦 Found ${recipes.length} recipes in current batch.`);

    let updated = 0;
    let skipped = 0;

    for (const r of recipes) {
      if (r.mealSlot) {
        skipped++;
        continue;
      }

      let slots = r.mealSlots || [];
      if (typeof slots === 'string') {
        try { slots = JSON.parse(slots); } catch { slots = [slots]; }
      }

      const primarySlot = Array.isArray(slots) ? slots.map(s => SLOT_MAP[s]).find(s => !!s) : null;

      if (primarySlot) {
        const updateRes = await fetch(`${STRAPI_URL}/api/recipes/${r.documentId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TOKEN}` 
          },
          body: JSON.stringify({ data: { mealSlot: primarySlot } })
        });
        
        if (updateRes.ok) {
          console.log(`✅ Updated "${r.name}" -> ${primarySlot}`);
          updated++;
        } else {
          console.error(`❌ Failed "${r.name}": ${updateRes.status}`);
        }
        await new Promise(r => setTimeout(r, 150));
      } else {
        skipped++;
      }
    }

    console.log(`\n🎉 DONE. Updated: ${updated}, Skipped/Already set: ${skipped}`);
  } catch (err) {
    console.error('❌ Error during migration:', err.message);
  }
}

main();
