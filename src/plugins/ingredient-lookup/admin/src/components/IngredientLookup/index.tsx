import {
    Button,
    Combobox,
    ComboboxOption,
    Field,
    Flex
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

    const [isCalculating, setIsCalculating] = useState(false);

    // Grab the current form values and the change handler
    const { values, onChange: onFormChange } = useForm();

    console.log('[MACRO-CALC] Component Render. Values:', values, 'onChange exists:', !!onFormChange);

    const handleCalculateMacros = async () => {
        console.log('[MACRO-CALC] frontend Calculate button clicked. Values:', values);
        if (!values.ingredients || !Array.isArray(values.ingredients) || !onFormChange) {
            console.error('[MACRO-CALC] Cannot calculate: ', {
                hasIngredients: !!values.ingredients,
                isArray: Array.isArray(values.ingredients),
                hasOnChange: !!onFormChange
            });
            return;
        }

        setIsCalculating(true);
        try {
            // Use the stored slugs instead of names if possible for better accuracy
            const ingredientsToCalculate = values.ingredients.map(ing => ({
                name: ing.slug || ing.name,
                amount: ing.amount,
                unit: ing.unit
            }));

            const { data: res } = await post('/api/ingredients/calculate-macros', {
                ingredients: ingredientsToCalculate
            });

            const result = res?.data || res;
            console.log('[MACRO-CALC] Full API Response:', JSON.stringify(result));

            if (result && result.macros) {
                // Update kcal
                console.log('[MACRO-CALC] Setting kcal:', result.kcal);
                onFormChange('kcal', result.kcal);

                // Update macros component as a single object to ensure Strapi 5 sees it correctly
                console.log('[MACRO-CALC] Setting macros object:', JSON.stringify(result.macros));
                onFormChange('macros', result.macros);
            } else {
                console.warn('[MACRO-CALC] API did not return valid macros structure:', result);
            }
        } catch (err) {
            console.error('[MACRO-CALC] Failed to calculate macros:', err);
        } finally {
            setIsCalculating(false);
        }
    };

    // Auto-calculate macros when ingredients change
    useEffect(() => {
        if (!values.ingredients || values.ingredients.length === 0) return;

        const timer = setTimeout(() => {
            console.log('[MACRO-CALC] Auto-triggering calculation. Ingredients:', values.ingredients.length);
            handleCalculateMacros();
        }, 500); // Wait 500ms after last change (snappier)

        return () => clearTimeout(timer);
    }, [JSON.stringify(values.ingredients)]);

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
        // Update the primary name field
        onChange({ target: { name, value: selectedValue, type: 'string' } });

        // Update the hidden slug field if we find a match in the loaded options
        const match = options.find((opt: any) => opt.name === selectedValue);
        if (match && onFormChange && name.includes('.name')) {
            const slugPath = name.replace('.name', '.slug');
            onFormChange(slugPath, (match as any).slug);
        }
    };

    return (
        <Field.Root name={name} id={name} error={error} hint={description} required={required}>
            <Flex justifyContent="space-between" alignItems="center" marginBottom={1}>
                <Field.Label>{formatMessage(intlLabel)}</Field.Label>
                {(name?.startsWith('ingredients.') && name?.endsWith('.name')) && (
                    <Button variant="secondary" size="S" onClick={handleCalculateMacros} loading={isCalculating}>
                        Przelicz makra
                    </Button>
                )}
            </Flex>
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
