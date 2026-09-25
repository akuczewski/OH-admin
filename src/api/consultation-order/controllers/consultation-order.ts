import { factories } from '@strapi/strapi';

const ORDER_UID = 'api::consultation-order.consultation-order' as const;
const EXPERT_UID = 'api::expert.expert' as const;
const CODE_UID = 'api::consultation-code.consultation-code' as const;

function computeDiscountedGrosze(basePriceGrosze: number, discountPercent: number): number {
    return Math.round((basePriceGrosze * (100 - discountPercent)) / 100);
}

// @ts-ignore
export default factories.createCoreController(ORDER_UID, ({ strapi }) => ({
    /**
     * Tworzy zamówienie w stanie `pending` i zwraca kwotę do obciążenia.
     * Cena liczona WYŁĄCZNIE tutaj (Strapi) z expert.priceGrosze i
     * consultation-code.discountPercent — landing nigdy nie przysyła kwoty.
     *
     * NIE rezerwuje kodu (redeemedAt zostaje null aż do mark-paid) — dzięki temu
     * porzucony koszyk nie spala kodu. Ryzyko dwóch równoległych zamówień na tym
     * samym kodzie jest zaakceptowane i obsłużone w mark-paid (duplicateCodeUse).
     */
    async createPending(ctx: any) {
        const { expertId, email, code } = ctx.request.body ?? {};

        if (typeof expertId !== 'string' || !expertId) {
            return ctx.badRequest('expertId wymagany');
        }
        if (typeof email !== 'string' || !/.+@.+\..+/.test(email)) {
            return ctx.badRequest('poprawny email wymagany');
        }

        const expert = await strapi.db.query(EXPERT_UID).findOne({ where: { documentId: expertId } });
        if (!expert || !expert.active) {
            return ctx.badRequest('ekspert niedostępny');
        }

        let discountPercent = 0;
        let codeEntry: any = null;
        if (code) {
            if (typeof code !== 'string') return ctx.badRequest('nieprawidłowy kod');
            codeEntry = await strapi.db.query(CODE_UID).findOne({ where: { code: code.trim().toUpperCase() } });
            if (!codeEntry) {
                return ctx.badRequest('Kod rabatowy jest nieprawidłowy');
            }
            if (codeEntry.redeemedAt) {
                return ctx.badRequest('Ten kod rabatowy został już wykorzystany');
            }
            discountPercent = codeEntry.discountPercent;
        }

        const priceGrosze = computeDiscountedGrosze(expert.priceGrosze, discountPercent);

        const order = await strapi.db.query(ORDER_UID).create({
            data: {
                expert: expert.id,
                email: email.trim(),
                priceGrosze,
                discountCode: codeEntry ? codeEntry.id : null,
                status: 'pending',
            },
        });

        ctx.body = { orderId: order.documentId, priceGrosze };
    },

    /**
     * Oznacza zamówienie jako opłacone. Wołane WYŁĄCZNIE z webhooka Stripe na
     * landingu (checkout.session.completed). Jedyne miejsce, które flipuje status
     * na `paid`.
     *
     * - idempotentne: powtórne wywołanie (retry Stripe) nie duplikuje efektu;
     * - NIGDY nie odmawia oznaczenia opłaty: jeśli kod jest już zredeemowany przez
     *   inne zamówienie, i tak flipuje na `paid` i ustawia duplicateCodeUse=true
     *   do ręcznego przeglądu (pieniądze przyszły, klientka musi dostać link).
     */
    async markPaid(ctx: any) {
        const { orderId, stripeSessionId, stripePaymentIntentId } = ctx.request.body ?? {};
        if (typeof orderId !== 'string' || !orderId) {
            return ctx.badRequest('orderId wymagany');
        }

        const order = await strapi.db.query(ORDER_UID).findOne({
            where: { documentId: orderId },
            populate: { expert: true, discountCode: true },
        });
        if (!order) {
            return ctx.notFound('zamówienie nie istnieje');
        }

        if (order.status === 'paid') {
            // Już przetworzone — retry webhooka.
            ctx.body = { status: 'paid', alreadyProcessed: true, calendlyUrl: order.calendlyUrlSent };
            return;
        }

        const result = await strapi.db.transaction(async () => {
            let duplicateCodeUse = false;

            if (order.discountCode) {
                const freshCode = await strapi.db.query(CODE_UID).findOne({
                    where: { id: order.discountCode.id },
                    populate: { order: true },
                });
                if (freshCode?.redeemedAt && freshCode.order?.id !== order.id) {
                    // Kod użyty już przez INNE zamówienie — nie blokujemy, flagujemy.
                    duplicateCodeUse = true;
                } else if (!freshCode?.redeemedAt) {
                    await strapi.db.query(CODE_UID).update({
                        where: { id: order.discountCode.id },
                        data: { redeemedAt: new Date().toISOString(), order: order.id },
                    });
                }
            }

            const updated = await strapi.db.query(ORDER_UID).update({
                where: { id: order.id },
                data: {
                    status: 'paid',
                    stripeSessionId: stripeSessionId ?? order.stripeSessionId,
                    stripePaymentIntentId: stripePaymentIntentId ?? order.stripePaymentIntentId,
                    calendlyUrlSent: order.expert?.calendlyUrl ?? null,
                    duplicateCodeUse,
                },
            });
            return updated;
        });

        ctx.body = {
            status: 'paid',
            calendlyUrl: result.calendlyUrlSent,
            duplicateCodeUse: result.duplicateCodeUse,
        };
    },
}));
