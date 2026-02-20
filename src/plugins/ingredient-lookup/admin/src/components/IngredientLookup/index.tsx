import {
    Combobox,
    ComboboxOption,
    Field
} from '@strapi/design-system';
// @ts-ignore
import { useFetchClient, useForm } from '@strapi/strapi/admin'; // Strapi 5 standard import
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const IngredientLookup = ({
    name,
    onChange,
    value,
    intlLabel,
    disabled,
    error,
    description,
    required,
}) => {
    const { formatMessage } = useIntl();
    const [options, setOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchValue, setSearchValue] = useState(value || '');
    const { get, post } = useFetchClient();

    // Grab the current form values and the change handler
    const formContext = useForm('IngredientLookup', (state) => state);
    const values = formContext?.values || {};
    const onFormChange = formContext?.onChange;

    useEffect(() => {
        // Trigger macro calculation whenever ingredients change
        if (values?.ingredients && Array.isArray(values.ingredients) && onFormChange) {
            // Only trigger if we are the FIRST ingredient row to avoid duplicate API calls
            // or just use a shared debounce timer outside the component
            triggerMacroCalculation(values.ingredients, post, onFormChange);
        }
    }, [values?.ingredients, post, onFormChange]);

    useEffect(() => {
        if (searchValue.length < 2) {
            setOptions([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const { data } = await get(`/api/ingredients/search?q=${searchValue}`);
                setOptions(data || []);
            } catch (err) {
                console.error('Search error', err);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchValue, get]);

    const handleInputChange = (e) => {
        setSearchValue(e.target.value);
    };

    const handleSelect = (selectedValue) => {
        onChange({ target: { name, value: selectedValue, type: 'string' } });
    };

    return (
        <Field.Root name={name} id={name} error={error} hint={description} required={required}>
            <Field.Label>{formatMessage(intlLabel)}</Field.Label>
            <Combobox
                placeholder="Zacznij pisać nazwę składnika..."
                disabled={disabled}
                value={value}
                onChange={handleSelect}
                onInputChange={handleInputChange}
                loading={isLoading}
            >
                {options.map((opt: any) => (
                    <ComboboxOption key={opt.slug} value={opt.name}>
                        {opt.name} ({opt.category})
                    </ComboboxOption>
                ))}
            </Combobox>
            <Field.Hint />
            <Field.Error />
        </Field.Root>
    );
};

export default IngredientLookup;

// Global debounce timer to prevent multiple calculations if multiple components trigger it
let calculationTimer: any;

const triggerMacroCalculation = (ingredients: any[], post: any, onChange: any) => {
    clearTimeout(calculationTimer);
    calculationTimer = setTimeout(async () => {
        try {
            // Optional: skip calculation if no ingredients have an amount
            const hasAmount = ingredients.some((img: any) => img.name && img.amount);
            if (!hasAmount) return;

            const { data } = await post('/api/ingredients/calculate-macros', {
                ingredients
            });

            const result = data?.data || data;

            if (result && result.macros) {
                console.log('[MACRO-CALC] Updating frontend form with macros:', result);
                onChange({ target: { name: 'kcal', value: result.kcal, type: 'integer' } });
                onChange({ target: { name: 'macros.protein', value: result.macros.protein, type: 'integer' } });
                onChange({ target: { name: 'macros.carbs', value: result.macros.carbs, type: 'integer' } });
                onChange({ target: { name: 'macros.fat', value: result.macros.fat, type: 'integer' } });
                onChange({ target: { name: 'macros.fiber', value: result.macros.fiber, type: 'integer' } });
            }
        } catch (err) {
            console.error('[MACRO-CALC] Failed to request macro calculation:', err);
        }
    }, 800);
};
