

export default {
    config: {
        locales: ['pl'],
    },
    register(app: any) {
        console.log('[APP] Registering dummy ingredient-lookup custom field...');

        app.customFields.register({
            name: 'ingredient-lookup',
            pluginId: 'ingredient-lookup',
            type: 'string',
            intlLabel: {
                id: 'ingredient-lookup.label',
                defaultMessage: 'Ingredient Lookup (Dummy)',
            },
            intlDescription: {
                id: 'ingredient-lookup.description',
                defaultMessage: 'Search and select an ingredient',
            },
            components: {
                Input: async () => {
                    return (props: any) => (
                        <div style={{ padding: '10px', border: '1px solid red' }}>
                            <label>{props.name}</label>
                            <input
                                {...props}
                                style={{ width: '100%', background: 'black', color: 'white' }}
                                onChange={(e) => props.onChange({ target: { name: props.name, value: e.target.value, type: 'string' } })}
                            />
                            <p style={{ color: 'red' }}>If you see this red box, registration works!</p>
                        </div>
                    );
                },
            },
        });
    },
};
