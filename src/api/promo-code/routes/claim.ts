export default {
    routes: [
        {
            method: 'POST',
            path: '/promo-codes/claim',
            handler: 'promo-code.claim',
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};
