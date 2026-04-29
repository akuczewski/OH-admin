import axios from 'axios';

const STRAPI_URL = 'https://oh-club-cms-v5.strapiapp.com';
const STRAPI_TOKEN = process.env.EXPO_PUBLIC_STRAPI_TOKEN;

async function checkRecentRecipes() {
  if (!STRAPI_TOKEN) {
    console.error('Missing EXPO_PUBLIC_STRAPI_TOKEN');
    return;
  }

  try {
    console.log('--- Checking recipes created today ---');
    
    // Pobieramy przepisy posortowane od najnowszych
    const response = await axios.get(`${STRAPI_URL}/api/recipes`, {
      headers: {
        Authorization: `Bearer ${STRAPI_TOKEN}`,
      },
      params: {
        sort: 'createdAt:desc',
        pagination: { limit: 50 },
      }
    });

    const recipes = response.data.data;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const createdToday = recipes.filter((r: any) => r.createdAt.startsWith(today));

    if (createdToday.length === 0) {
      console.log('No recipes created today. Base seems clean.');
    } else {
      console.log(`Found ${createdToday.length} recipes created today:`);
      createdToday.forEach((r: any) => {
        console.log(`- [${r.documentId}] ${r.name} (Created at: ${r.createdAt})`);
      });
      
      console.log('\n--- RECOMMENDATION ---');
      console.log('These recipes were likely created by the accidental seeder run.');
      console.log('If they are duplicates or unwanted, they should be deleted.');
    }

    // Sprawdźmy też składniki "widma" (kcal=0) stworzone dzisiaj
    console.log('\n--- Checking ingredients created today with 0 kcal ---');
    const ingResponse = await axios.get(`${STRAPI_URL}/api/skladniks`, {
      headers: {
        Authorization: `Bearer ${STRAPI_TOKEN}`,
      },
      params: {
        filters: {
          kcal: 0,
          createdAt: { $contains: today }
        },
        pagination: { limit: 50 },
      }
    });

    const ghostIngs = ingResponse.data.data;
    if (ghostIngs.length === 0) {
      console.log('No ghost ingredients found.');
    } else {
      console.log(`Found ${ghostIngs.length} ghost ingredients:`);
      ghostIngs.forEach((i: any) => {
        console.log(`- [${i.documentId}] ${i.name}`);
      });
    }

  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkRecentRecipes();
