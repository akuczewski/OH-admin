

export default {
    config: {
        locales: ['pl'],
    },
    register(app) {
        console.log('[APP] Registering global fallback for ingredient-lookup...');

        app.customFields.register({
            name: 'ingredient-lookup',
            pluginId: 'ingredient-lookup',
            type: 'string',
            intlLabel: {
                id: 'ingredient-lookup.label',
                defaultMessage: 'Ingredient Lookup (Global)',
            },
            intlDescription: {
                id: 'ingredient-lookup.description',
                defaultMessage: 'Global fallback registration',
            },
            components: {
                Input: async () => {
                    return (props) => {
                        return (
                            <div style={{
                                padding: '12px',
                                border: '1px solid #4a4a6a',
                                borderRadius: '4px',
                                backgroundColor: '#212134'
                            }}>
                                <label style={{ color: '#d9d9d9', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                                    Smart Ingredient (Fix Mode)
                                </label>
                                <input
                                    {...props}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        borderRadius: '4px',
                                        border: '1px solid #32324d',
                                        backgroundColor: '#181826',
                                        color: 'white'
                                    }}
                                    onChange={(e) => props.onChange({ target: { name: props.name, value: e.target.value, type: 'string' } })}
                                    placeholder="Jeśli to widzisz, rejestracja działa!"
                                />
                            </div>
                        );
                    };
                },
            },
        });
    },
};
