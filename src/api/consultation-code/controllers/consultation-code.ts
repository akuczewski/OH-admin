import { factories } from '@strapi/strapi';

const UID = 'api::consultation-code.consultation-code' as const;

// Standardowy rabat per tier w momencie wydania kodu. % ląduje na rekordzie
// (pole discountPercent), więc support może potem podbić konkretnej userce w
// adminie. Zmiana samej stałej perku = 1-liniowa zmiana w kodzie — akceptowalne,
// spójne z poziomem rygoru promo-code ("nie jest to system płatności").
const TIER_DISCOUNT_PERCENT: Record<string, number> = {
    basic: 10,
    premium: 30,
};

// Bez 0/O/1/I/L — kod bywa przepisywany ręcznie z apki do checkoutu na landingu.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(): string {
    let s = '';
    for (let i = 0; i < 6; i++) {
        s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return `KO-${s}`;
}

// @ts-ignore
export default factories.createCoreController(UID, ({ strapi }) => ({
    /**
     * Wydaje / zwraca kod rabatowy na konsultację dla danej userki.
     *
     * Idempotentne (wzorem ensureBalanceaCode): jeśli userka ma już kod, który
     * nie został jeszcze wykorzystany w opłaconym zamówieniu (redeemedAt == null),
     * zwracamy ten sam kod. Dopiero po jego wykorzystaniu kolejne wywołanie
     * wygeneruje nowy (userka może kupić np. dietetyka, potem kosmetologa).
     *
     * Tier jest asertowany po stronie klienta (apka zna go z RevenueCat) —
     * świadoma decyzja z wywiadu (Q9): brak weryfikacji server-side w v1,
     * bounded ryzyko (~75 zł/kod), kody i tak jednorazowe.
     */
    async claim(ctx: any) {
        const tier = ctx.request.body?.tier;
        const firebaseUid = ctx.request.body?.firebaseUid;

        if (tier !== 'basic' && tier !== 'premium') {
            return ctx.badRequest('tier musi być "basic" albo "premium"');
        }
        if (typeof firebaseUid !== 'string' || firebaseUid.length < 8) {
            return ctx.badRequest('firebaseUid wymagany');
        }

        const discountPercent = TIER_DISCOUNT_PERCENT[tier];

        const result = await strapi.db.transaction(async () => {
            // Istniejący, jeszcze niewykorzystany kod tej userki?
            const existing = await strapi.db.query(UID).findOne({
                where: { firebaseUid, redeemedAt: null },
                orderBy: { id: 'desc' },
            });
            if (existing) {
                return { entry: existing, status: 'existing' as const };
            }

            // Nowy kod — kilka prób na wypadek kolizji unikalności.
            for (let attempt = 0; attempt < 5; attempt++) {
                const code = randomCode();
                const clash = await strapi.db.query(UID).findOne({ where: { code } });
                if (clash) continue;
                const entry = await strapi.db.query(UID).create({
                    data: {
                        code,
                        tier,
                        discountPercent,
                        firebaseUid,
                        issuedAt: new Date().toISOString(),
                    },
                });
                return { entry, status: 'issued' as const };
            }
            return null;
        });

        if (!result) {
            strapi.log.error('[consultation-code] Nie udało się wygenerować unikalnego kodu po 5 próbach');
            return ctx.internalServerError('Nie udało się wygenerować kodu, spróbuj ponownie');
        }

        ctx.body = {
            code: result.entry.code,
            discountPercent: result.entry.discountPercent,
            status: result.status,
        };
    },
}));
