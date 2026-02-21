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

    console.log('[MACRO-CALC V5.0 - STABILITY] Component Render. Values:', values, 'onChange exists:', !!onFormChange);

    const handleDebugForm = () => {
        console.log('--- [INGREDIENT-DEBUG V5.0 - STABILITY] FORM STATE ---');
        console.log('Values:', JSON.stringify(values, null, 2));
        console.log('onFormChange exists:', !!onFormChange);
        console.log('-----------------------------------------');
    };

    const handleCalculateMacros = async () => {
        console.log('[MACRO-CALC V5.0 - STABILITY] Calculate triggered. Ingredients:', values?.ingredients?.length);
        if (!values.ingredients || !Array.isArray(values.ingredients) || !onFormChange) {
            console.error('[MACRO-CALC V5.0 - STABILITY] Cannot calculate: ', {
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

            console.log('[MACRO-CALC V5.0 - STABILITY] Sending request to API...');
            const { data: res } = await post('/api/ingredients/calculate-macros', {
                ingredients: ingredientsToCalculate
            });

            const result = res?.data || res;
            console.log('[MACRO-CALC V5.0 - STABILITY] Full API Response:', JSON.stringify(result));

            if (result && result.macros) {
                // Update kcal
                console.log('[MACRO-CALC V5.0 - STABILITY] Setting kcal:', result.kcal);
                onFormChange('kcal', result.kcal);

                // Ensure macros object exists in state
                if (!values.macros) {
                    console.log('[MACRO-CALC V5.0 - STABILITY] Initializing macros object in form state');
                    onFormChange('macros', { protein: 0, carbs: 0, fat: 0, fiber: 0 });
                }

                // Update macros component as a single object to ensure Strapi 5 sees it correctly
                console.log('[MACRO-CALC V5.0 - STABILITY] Attempting to set macros object:', JSON.stringify(result.macros));
                onFormChange('macros', result.macros);

                // Fallback: also try to set individual fields in case Strapi 5 requires it for nested state tracking
                onFormChange('macros.protein', result.macros.protein);
                onFormChange('macros.carbs', result.macros.carbs);
                onFormChange('macros.fat', result.macros.fat);
                onFormChange('macros.fiber', result.macros.fiber);

                console.log('[MACRO-CALC V5.0 - STABILITY] All form fields updated.');
            } else {
                console.warn('[MACRO-CALC V5.0 - STABILITY] API did not return valid macros structure:', result);
            }
        } catch (err: any) {
            console.error('[MACRO-CALC V5.0 - STABILITY] Failed to calculate macros:', err);
            // If the server is 503ing, give the user a clear hint
            if (err.response?.status === 503) {
                alert('Serwer jest przeciążony lub trwa restart (503). Spróbuj ponownie za 30 sekund.');
            }
        } finally {
            setIsCalculating(false);
        }
    };

    // Auto-calculate macros when ingredients change
    useEffect(() => {
        if (!values.ingredients || values.ingredients.length === 0) return;

        const timer = setTimeout(() => {
            console.log('[MACRO-CALC V5.0 - STABILITY] Auto-triggering calculation.');
            handleCalculateMacros();
        }, 800); // Increased debounce slightly for stability

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
                    <Flex gap={2}>
                        <Button variant="tertiary" size="S" onClick={handleDebugForm}>
                            DEBUG FORM
                        </Button>
                        <Button variant="secondary" size="S" onClick={handleCalculateMacros} loading={isCalculating}>
                            Przelicz makra
                        </Button>
                    </Flex>
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
