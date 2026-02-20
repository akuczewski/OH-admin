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
    const formContext = useForm('IngredientLookup', (state) => state);
    const values = formContext?.values || {};
    const onFormChange = formContext?.onChange;

    const handleCalculateMacros = async () => {
        if (!values.ingredients || !Array.isArray(values.ingredients) || !onFormChange) {
            return;
        }

        setIsCalculating(true);
        try {
            const { data } = await post('/api/ingredients/calculate-macros', {
                ingredients: values.ingredients
            });

            const result = data?.data || data;

            if (result && result.macros) {
                console.log('[MACRO-CALC] Updating frontend form with macros:', result);

                // Update using string path signature for React Hook Form / Formik
                onFormChange('kcal', result.kcal);

                if (!values.macros) {
                    onFormChange('macros', result.macros);
                } else {
                    onFormChange('macros.protein', result.macros.protein);
                    onFormChange('macros.carbs', result.macros.carbs);
                    onFormChange('macros.fat', result.macros.fat);
                    onFormChange('macros.fiber', result.macros.fiber);
                }
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
        onChange({ target: { name, value: selectedValue, type: 'string' } });
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
