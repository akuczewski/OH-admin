
const axios = require('axios');

async function testSearch() {
  try {
    const cwd = process.cwd();
    console.log("cwd", cwd);
    // we need to access via HTTP or via Strapi context. Since Strapi isn't running as a script easily,
    // let's use strapi eval. We have a test script from before. let's re-run it!
  } catch(e) {
    console.log(e);
  }
}
testSearch();
