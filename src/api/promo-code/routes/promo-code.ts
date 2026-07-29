import { factories } from '@strapi/strapi';

// Domyślne trasy CRUD (find/findOne/create/update/delete) — używane przez
// scripts/seed-promo-codes.ts (GET do sprawdzenia idempotencji, POST do
// wgrania kodów). Publiczny dostęp mimo to zablokowany: rola "Public" nie ma
// (i nie powinna dostać) żadnych uprawnień do tego content-type w Users &
// Permissions — tak samo jak przy skladnik/inspiracja/creator. Realne wydawanie
// kodów userom idzie wyłącznie przez custom akcję "claim" (routes/claim.ts).
// @ts-ignore
export default factories.createCoreRouter('api::promo-code.promo-code');
