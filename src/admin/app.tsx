

export default {
    config: {
        locales: ['pl'],
    },
    register(app: any) {
        console.log('--- STRAPI GLOBAL REGISTER START ---');

        // Browser marker
        if (typeof window !== 'undefined') {
            (window as any).STRAPI_GLOBAL_REGISTER_CALLED = true;
            localStorage.setItem('STRAPI_REGISTER_TIME', new Date().toISOString());
        }

        try {
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
                    defaultMessage: 'Fallback registration',
                },
                components: {
                    Input: async () => {
                        console.log('[DEBUG] Loading IngredientLookup Input widget...');
                        return (props: any) => (
                            <div style={{ padding: '12px', border: '2px solid #7b79ff', borderRadius: '4px', backgroundColor: '#212134', color: 'white' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                                    Smart Ingredient Input (Global)
                                </label>
                                <input
                                    {...props}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '4px',
                                        border: '1px solid #4a4a6a',
                                        backgroundColor: '#181826',
                                        color: 'white'
                                    }}
                                    value={props.value || ''}
                                    onChange={(e) => {
                                        if (props.onChange) {
                                            props.onChange({ target: { name: props.name, value: e.target.value, type: 'string' } });
                                        }
                                    }}
                                    placeholder="Wpisz nazwę..."
                                />
                                <p style={{ fontSize: '10px', color: '#7b79ff', marginTop: '6px' }}>
                                    If you see this, global registration is WORKING.
                                </p>
                            </div>
                        );
                    },
                },
            });
            console.log('--- STRAPI GLOBAL REGISTER SUCCESS ---');
        } catch (err) {
            console.error('--- STRAPI GLOBAL REGISTER ERROR ---', err);
        }
    },
    bootstrap(app: any) {
        console.log('--- STRAPI GLOBAL BOOTSTRAP ---');
    },
};
