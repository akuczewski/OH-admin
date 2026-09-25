/**
 * test-consultation-flow.ts
 *
 * Checkpoint A→B/C (SPEC-konsultacje.md §15): bootuje Strapi programistycznie
 * i sprawdza logikę kontrolerów konsultacji bezpośrednio (mock ctx) —
 * bez warstwy HTTP/permission (ta jest standardowym Strapi, identyczna jak
 * promo-code).
 *
 * Sprawdza:
 *  - consultation-code.claim: idempotencja (ten sam uid -> ten sam kod), inny uid -> inny kod
 *  - consultation-order.createPending: przeliczenie ceny (brak / basic 10% / premium 30%)
 *  - createPending odrzuca już zredeemowany kod
 *  - markPaid: flip na paid, redeemedAt na kodzie, idempotencja (2x = brak duplikatu)
 *  - dwa zamówienia na tym samym kodzie + 2x markPaid -> oba paid, drugie duplicateCodeUse=true
 *
 * Użycie: cd apps/cms && npx tsx scripts/test-consultation-flow.ts
 */
import { compileStrapi, createStrapi } from '@strapi/strapi';

const EXPERT_UID = 'api::expert.expert';
const CODE_UID = 'api::consultation-code.consultation-code';
const ORDER_UID = 'api::consultation-order.consultation-order';

let passed = 0;
let failed = 0;
function assert(cond: any, msg: string) {
    if (cond) {
        passed++;
        console.log(`  ✅ ${msg}`);
    } else {
        failed++;
        console.error(`  ❌ ${msg}`);
    }
}

function mockCtx(body: any) {
    const ctx: any = {
        request: { body },
        badRequest: (m: string) => { ctx._err = { kind: 'badRequest', m }; return ctx._err; },
        notFound: (m: string) => { ctx._err = { kind: 'notFound', m }; return ctx._err; },
        internalServerError: (m: string) => { ctx._err = { kind: 'internalServerError', m }; return ctx._err; },
        _err: null,
        body: undefined,
    };
    return ctx;
}

async function main() {
    const appContext = await compileStrapi();
    // @ts-ignore
    const strapi = await createStrapi(appContext).load();
    strapi.log.level = 'error';

    const codeCtrl: any = strapi.controller(CODE_UID);
    const orderCtrl: any = strapi.controller(ORDER_UID);

    // sprzątanie po poprzednich uruchomieniach
    const testUids = ['test-uid-basic-0000', 'test-uid-premium-0000', 'test-uid-other-0000'];
    for (const uid of testUids) {
        const codes = await strapi.db.query(CODE_UID).findMany({ where: { firebaseUid: uid } });
        for (const c of codes) {
            await strapi.db.query(ORDER_UID).deleteMany({ where: { discountCode: c.id } });
            await strapi.db.query(CODE_UID).delete({ where: { id: c.id } });
        }
    }

    let expert = await strapi.db.query(EXPERT_UID).findOne({ where: { specialization: 'dietetyk' } });
    if (!expert) {
        expert = await strapi.db.query(EXPERT_UID).create({
            data: {
                name: 'TEST Dietetyk', title: 'test', specialization: 'dietetyk',
                calendlyUrl: 'https://calendly.com/test/x', priceGrosze: 24900,
                expertPayoutGrosze: 12450, vatTreatment: 'exempt', active: true,
            },
        });
        console.log('  (utworzono testowego eksperta)');
    }
    const expertId: string = expert.documentId;

    console.log('\n▶ consultation-code.claim');
    let ctx = mockCtx({ tier: 'basic', firebaseUid: 'test-uid-basic-0000' });
    await codeCtrl.claim(ctx);
    assert(ctx.body?.status === 'issued', 'pierwszy claim -> issued');
    assert(ctx.body?.discountPercent === 10, 'basic -> discountPercent 10');
    const basicCode = ctx.body.code;
    assert(/^KO-[A-Z2-9]{6}$/.test(basicCode), `kod w formacie KO-XXXXXX (${basicCode})`);

    ctx = mockCtx({ tier: 'basic', firebaseUid: 'test-uid-basic-0000' });
    await codeCtrl.claim(ctx);
    assert(ctx.body?.status === 'existing' && ctx.body?.code === basicCode, 'drugi claim tego samego uid -> ten sam kod (existing)');

    ctx = mockCtx({ tier: 'premium', firebaseUid: 'test-uid-premium-0000' });
    await codeCtrl.claim(ctx);
    assert(ctx.body?.discountPercent === 30, 'premium -> discountPercent 30');
    const premiumCode = ctx.body.code;
    assert(premiumCode !== basicCode, 'inny uid -> inny kod');

    ctx = mockCtx({ tier: 'gold', firebaseUid: 'test-uid-other-0000' });
    await codeCtrl.claim(ctx);
    assert(ctx._err?.kind === 'badRequest', 'nieprawidłowy tier -> badRequest');

    console.log('\n▶ consultation-order.createPending');
    ctx = mockCtx({ expertId, email: 'a@b.com' });
    await orderCtrl.createPending(ctx);
    assert(ctx.body?.priceGrosze === 24900, `bez kodu -> 24900 (dostał ${ctx.body?.priceGrosze})`);
    const orderNoCode = ctx.body.orderId;

    ctx = mockCtx({ expertId, email: 'a@b.com', code: basicCode });
    await orderCtrl.createPending(ctx);
    assert(ctx.body?.priceGrosze === 22410, `basic 10% -> 22410 (dostał ${ctx.body?.priceGrosze})`);
    const orderBasic = ctx.body.orderId;

    ctx = mockCtx({ expertId, email: 'a@b.com', code: premiumCode });
    await orderCtrl.createPending(ctx);
    assert(ctx.body?.priceGrosze === 17430, `premium 30% -> 17430 (dostał ${ctx.body?.priceGrosze})`);
    const orderPremium = ctx.body.orderId;

    ctx = mockCtx({ expertId, email: 'a@b.com', code: 'KO-NOPENOPE' });
    await orderCtrl.createPending(ctx);
    assert(ctx._err?.kind === 'badRequest', 'nieistniejący kod -> badRequest');

    // drugie zamówienie na tym samym basicCode (kod jeszcze nie zredeemowany)
    ctx = mockCtx({ expertId, email: 'c@d.com', code: basicCode });
    await orderCtrl.createPending(ctx);
    assert(ctx.body?.priceGrosze === 22410, 'drugie createPending na tym samym niezredeemowanym kodzie przechodzi (nie rezerwuje)');
    const orderBasicDup = ctx.body.orderId;

    console.log('\n▶ consultation-order.markPaid');
    ctx = mockCtx({ orderId: orderBasic, stripeSessionId: 'cs_test_1', stripePaymentIntentId: 'pi_1' });
    await orderCtrl.markPaid(ctx);
    assert(ctx.body?.status === 'paid', 'markPaid -> status paid');
    const paidOrder = await strapi.db.query(ORDER_UID).findOne({ where: { documentId: orderBasic } });
    assert(paidOrder?.status === 'paid', 'zamówienie w bazie ma status paid');
    assert(paidOrder?.calendlyUrlSent === expert.calendlyUrl, 'calendlyUrlSent zapisany z eksperta');
    const redeemed = await strapi.db.query(CODE_UID).findOne({ where: { code: basicCode } });
    assert(!!redeemed?.redeemedAt, 'kod ma ustawione redeemedAt');

    ctx = mockCtx({ orderId: orderBasic, stripeSessionId: 'cs_test_1' });
    await orderCtrl.markPaid(ctx);
    assert(ctx.body?.alreadyProcessed === true, 'drugi markPaid tego samego zamówienia -> alreadyProcessed (idempotencja)');

    // drugie zamówienie na tym samym (już zredeemowanym) kodzie
    ctx = mockCtx({ orderId: orderBasicDup, stripeSessionId: 'cs_test_dup' });
    await orderCtrl.markPaid(ctx);
    assert(ctx.body?.status === 'paid', 'markPaid dla zamówienia z już-zredeemowanym kodem -> nadal paid (nie odmawia)');
    assert(ctx.body?.duplicateCodeUse === true, 'flaga duplicateCodeUse = true');

    // createPending z już zredeemowanym kodem -> odrzuca
    ctx = mockCtx({ expertId, email: 'x@y.com', code: basicCode });
    await orderCtrl.createPending(ctx);
    assert(ctx._err?.kind === 'badRequest', 'createPending z już zredeemowanym kodem -> badRequest');

    // sprzątanie
    for (const oid of [orderNoCode, orderBasic, orderPremium, orderBasicDup]) {
        await strapi.db.query(ORDER_UID).delete({ where: { documentId: oid } }).catch(() => {});
    }
    for (const uid of testUids) {
        await strapi.db.query(CODE_UID).deleteMany({ where: { firebaseUid: uid } });
    }
    await strapi.db.query(ORDER_UID).deleteMany({ where: { documentId: orderPremium } }).catch(() => {});

    console.log(`\n${failed === 0 ? '✅ WSZYSTKO OK' : '❌ SĄ BŁĘDY'} — ${passed} passed, ${failed} failed`);
    await strapi.destroy();
    process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
    console.error('❌ Test wywalił się:', err);
    process.exit(1);
});
