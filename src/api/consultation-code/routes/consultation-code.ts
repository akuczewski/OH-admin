import { factories } from '@strapi/strapi';

// Domyślne trasy CRUD — używane przez landing (server-side, dedykowany token) do
// odczytu/aktualizacji kodu przy mark-paid. Rola "Public": zero uprawnień
// (wzorem promo-code). Wydawanie kodów userkom idzie wyłącznie przez custom
// akcję "claim" (routes/claim.ts).
// @ts-ignore
export default factories.createCoreRouter('api::consultation-code.consultation-code');
