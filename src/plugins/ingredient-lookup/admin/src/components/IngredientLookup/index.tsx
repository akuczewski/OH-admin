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

    const handleCalculateMacros = async () => {
        if (!values.ingredients || !Array.isArray(values.ingredients) || !onFormChange) {
            console.error('[MACRO-CALC] Form values or onChange missing');
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

            if (result && result.macros) {
                console.log('[MACRO-CALC] Updating form with result:', result);

                // Update kcal
                onFormChange('kcal', result.kcal);

                // Update macros object fields individually to ensure nested state updates
                onFormChange('macros.protein', result.macros.protein);
                onFormChange('macros.carbs', result.macros.carbs);
                onFormChange('macros.fat', result.macros.fat);
                onFormChange('macros.fiber', result.macros.fiber);
            } else {
                console.warn('[MACRO-CALC] No macros returned from API');
            }
        } catch (err) {
            console.error('[MACRO-CALC] Failed to calculate macros:', err);
        } finally {
            setIsCalculating(false);
        }
    };

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
