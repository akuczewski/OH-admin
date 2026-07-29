import { factories } from '@strapi/strapi';

// Domyślne trasy CRUD (find/findOne/create/update/delete) wyłączone — kody
// promocyjne nie mają być listowane/edytowane przez REST API, tylko wydawane
// jednorazowo przez akcję "claim" (patrz routes/claim.ts). Zarządzanie odbywa
// się z panelu admina Strapi (Content Manager), który nie korzysta z tych tras.
// @ts-ignore
export default factories.createCoreRouter('api::promo-code.promo-code', {
    only: [],
});
