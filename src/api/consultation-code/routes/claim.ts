export default {
    routes: [
        {
            method: 'POST',
            path: '/consultation-codes/claim',
            handler: 'consultation-code.claim',
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};
