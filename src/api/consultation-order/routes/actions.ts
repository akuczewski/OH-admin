export default {
    routes: [
        {
            method: 'POST',
            path: '/consultation-orders/create-pending',
            handler: 'consultation-order.createPending',
            config: { policies: [], middlewares: [] },
        },
        {
            method: 'POST',
            path: '/consultation-orders/mark-paid',
            handler: 'consultation-order.markPaid',
            config: { policies: [], middlewares: [] },
        },
    ],
};
