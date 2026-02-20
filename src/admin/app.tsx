
import { Search } from '@strapi/icons';

// Self-contained V5 component to avoid any import/loop issues
const IngredientSearchV5 = (props: any) => {
    return (
        <div style={{ padding: '12px', border: '2px solid #00ff00', borderRadius: '4px', backgroundColor: '#1a1a2e', color: 'white' }}>
            <label style={{ color: '#00ff00', fontSize: '12px', marginBottom: '4px', display: 'block', fontWeight: 'bold' }}>
                Smart Ingredient (V5-FINAL)
            </label>
            <input
                {...props}
                style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #00ff00',
                    backgroundColor: '#0f0f1b',
                    color: 'white'
                }}
                value={props.value || ''}
                onChange={(e) => {
                    if (props.onChange) {
                        props.onChange({ target: { name: props.name, value: e.target.value, type: 'string' } });
                    }
                }}
                placeholder="Szukaj składnika (V5)..."
            />
            <p style={{ fontSize: '10px', color: '#00ff00', marginTop: '6px' }}>
                V5: Jeśli to widzisz, rejestracja GLOBALNA działa poprawnie.
            </p>
        </div>
    );
};

export default {
    config: {
        locales: ['pl'],
    },
    register(app: any) {
        console.log('--- V5-GLOBAL-REGISTER-START ---');

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
                Input: async () => IngredientSearchV5,
            },
        };

        try {
            app.customFields.register({
                ...fieldBase,
                name: 'ingredient',
            });
            console.log('--- V5-REGISTERED-SINGULAR ---');

            app.customFields.register({
                ...fieldBase,
                name: 'ingredient-lookup',
            });
            console.log('--- V5-REGISTERED-PLURAL ---');

        } catch (err) {
            console.error('--- V5-REGISTER-ERROR ---', err);
        }
    },
    bootstrap(app: any) {
        console.log('--- V5-GLOBAL-BOOTSTRAP ---');
    },
};
