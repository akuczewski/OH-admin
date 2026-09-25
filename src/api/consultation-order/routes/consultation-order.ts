import { factories } from '@strapi/strapi';

// Domyślne trasy CRUD — landing (server-side, dedykowany token) patchuje
// fakturowniaInvoiceId/emailSentAt przez standardowy update. Rola "Public":
// zero uprawnień (wzorem promo-code).
// @ts-ignore
export default factories.createCoreRouter('api::consultation-order.consultation-order');
