
module.exports = async ({ strapi }) => {
  console.log('--- TEST SEARCH SERVICE ---');
  try {
    const service = strapi.plugin('ingredient-lookup').service('ingredient');
    const results = await service.search('chleb');
    console.log('Results for "chleb":', JSON.stringify(results, null, 2));
    
    // Test direct document service
    const docs = await strapi.documents('api::skladnik.skladnik').findMany({
      filters: { name: { $containsi: 'chleb' } }
    });
    console.log('Direct docs findMany for "chleb":', docs.length);
  } catch (err) {
    console.error('Error during test:', err);
  }
};
