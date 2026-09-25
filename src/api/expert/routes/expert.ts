import { factories } from '@strapi/strapi';

// Domyślne trasy CRUD (find/findOne/create/update/delete). Odczyt przez landing
// (/konsultacje) i apkę (ekran Konsultacje) idzie dedykowanym API tokenem
// read-only, tak samo jak creator/recipe. Rola "Public" nie dostaje żadnych
// uprawnień do tego content-type — patrz komentarz w promo-code/routes/promo-code.ts.
// @ts-ignore
export default factories.createCoreRouter('api::expert.expert');
