
module.exports = async ({ strapi }) => {
  try {
    const results = await strapi.documents('api::skladnik.skladnik').findMany({
      filters: { name: { $containsi: 'banan' } }
    });
    console.log('Results size:', results.length);
    console.log('First result:', results[0] ? results[0].name : null);
  } catch(e) {
    console.log(e);
  }
};
