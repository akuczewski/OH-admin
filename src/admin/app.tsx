
import { Search } from '@strapi/icons';

// Self-contained V6 component to avoid any import/loop issues
const IngredientSearchV6 = (props: any) => {
    return (
        <div style={{ padding: '12px', border: '3px solid #ff00ff', borderRadius: '8px', backgroundColor: '#1a1a2e', color: 'white' }}>
            <label style={{ color: '#ff00ff', fontSize: '14px', marginBottom: '8px', display: 'block', fontWeight: 'bold' }}>
                Smart Ingredient (V6-REFRESH)
            </label>
            <input
                {...props}
                style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ff00ff',
                    backgroundColor: '#0f0f1b',
                    color: 'white'
                }}
                value={props.value || ''}
                onChange={(e) => {
                    if (props.onChange) {
                        props.onChange({ target: { name: props.name, value: e.target.value, type: 'string' } });
                    }
                }}
                placeholder="Wyszukaj składnik (V6)..."
            />
            <p style={{ fontSize: '11px', color: '#ff00ff', marginTop: '8px' }}>
                V6: Jeśli to widzisz, moduł został poprawnie załadowany jako obiekt default.
            </p>
        </div>
    );
};

export default {
    config: {
        locales: ['pl'],
    },
    register(app: any) {
        console.log('--- V6-GLOBAL-REGISTER-START ---');

        const fieldBase = {
            pluginId: 'ingredient-lookup',
            type: 'string',
            intlLabel: {
                id: 'ingredient-lookup.label',
                defaultMessage: 'Ingredient Lookup',
            },
            intlDescription: {
                id: 'ingredient-lookup.description',
                defaultMessage: 'Search and select an ingredient',
            },
            icon: Search,
            components: {
                // IMPORTANT: Strapi 5 often expects an object with a default property
                Input: async () => ({ default: IngredientSearchV6 }),
            },
        };

        try {
            app.customFields.register({
                ...fieldBase,
                name: 'ingredient',
            });
            console.log('--- V6-REGISTERED-SINGULAR ---');

            app.customFields.register({
                ...fieldBase,
                name: 'ingredient-lookup',
            });
            console.log('--- V6-REGISTERED-PLURAL ---');

        } catch (err) {
            console.error('--- V6-REGISTER-ERROR ---', err);
        }
    },
    bootstrap(app: any) {
        console.log('--- V6-GLOBAL-BOOTSTRAP ---');
    },
};
