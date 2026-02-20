
import { Search } from '@strapi/icons';

// Versioned, self-contained dummy component to stop all loops and import issues
const SimpleInput = (props: any) => {
    return (
        <div style={{ padding: '12px', border: '2px solid #7b79ff', borderRadius: '4px', backgroundColor: '#212134', color: 'white' }}>
            <label style={{ color: '#d9d9d9', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                Smart Ingredient (V4)
            </label>
            <input
                {...props}
                style={{
                    width: '100%',
                    padding: '8px',
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
                placeholder="Wpisz nazwę (V4)..."
            />
            <p style={{ fontSize: '10px', color: '#7b79ff', marginTop: '6px' }}>
                If you see this, registration is DEFINITIVELY working.
            </p>
        </div>
    );
};

export default {
    config: {
        locales: ['pl'],
    },
    register(app: any) {
        console.log('!!! GLOBAL REGISTER START (V4) !!!');

        const fieldBase = {
            pluginId: 'ingredient-lookup',
            type: 'string',
            intlLabel: {
                id: 'ingredient-lookup.label',
                defaultMessage: 'Ingredient Lookup',
            },
            intlDescription: {
                id: 'ingredient-lookup.description',
                defaultMessage: 'Search and select an ingredient from Firebase',
            },
            icon: Search,
            components: {
                Input: async () => SimpleInput,
            },
        };

        try {
            app.customFields.register({
                ...fieldBase,
                name: 'ingredient',
            });
            console.log('!!! REGISTERED: plugin::ingredient-lookup.ingredient !!!');

            app.customFields.register({
                ...fieldBase,
                name: 'ingredient-lookup',
            });
            console.log('!!! REGISTERED: plugin::ingredient-lookup.ingredient-lookup !!!');

        } catch (err) {
            console.error('!!! GLOBAL REGISTER ERROR !!!', err);
        }
    },
    bootstrap(app: any) {
        console.log('!!! GLOBAL BOOTSTRAP (V4) !!!');
    },
};
