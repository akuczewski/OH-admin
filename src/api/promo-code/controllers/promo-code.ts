import { factories } from '@strapi/strapi';

const UID = 'api::promo-code.promo-code' as const;

// Poniżej liczby wolnych kodów dla platformy loguje ostrzeżenie (widoczne w logach
// Strapi Cloud), żeby dało się dokupić/dograć kody zanim pula się wyczerpie.
const LOW_STOCK_THRESHOLD = 10;

// @ts-ignore
export default factories.createCoreController(UID, ({ strapi }) => ({
    /**
     * Wydaje jeden nieużyty kod dla danej platformy i oznacza go jako claimed.
     * Owinięte w transakcję: findOne + conditional update (where id + claimed:false)
     * eliminuje realne ryzyko wydania tego samego kodu dwóm osobom przy zwykłym ruchu
     * na stronie promocyjnej (nie jest to system płatności — pełne blokady wierszowe
     * na poziomie SQL byłyby tu nadmiarową złożonością).
     */
    async claim(ctx: any) {
        const platform = ctx.request.body?.platform;
        if (platform !== 'ios' && platform !== 'android') {
            return ctx.badRequest('platform musi być "ios" albo "android"');
        }

        const claimedEntry = await strapi.db.transaction(async () => {
            const candidate = await strapi.db.query(UID).findOne({
                where: { platform, claimed: false },
                orderBy: { id: 'asc' },
            });
            if (!candidate) return null;

            return strapi.db.query(UID).update({
                where: { id: candidate.id, claimed: false },
                data: { claimed: true, claimedAt: new Date().toISOString() },
            });
        });

        if (!claimedEntry) {
            ctx.body = { available: false };
            return;
        }

        const remaining = await strapi.db.query(UID).count({ where: { platform, claimed: false } });
        if (remaining <= LOW_STOCK_THRESHOLD) {
            strapi.log.warn(`[promo-code] Zostało już tylko ${remaining} nieużytych kodów dla platformy "${platform}"`);
        }

        ctx.body = { available: true, redeemUrl: claimedEntry.redeemUrl };
    },
}));
