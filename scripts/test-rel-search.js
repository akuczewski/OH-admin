
module.exports = async ({ strapi }) => {
  console.log('--- TEST RELATION SEARCH ---');
  try {
    // We try to find the internal relation service or just hit the core findMany
    const results = await strapi.documents('api::skladnik.skladnik').findMany({
        filters: { name: { $containsi: 'chleb' } },
        limit: 5
    });
    console.log('Results found:', results.length);
    if (results.length > 0) {
        console.log('Sample result:', JSON.stringify(results[0], null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  }
};
