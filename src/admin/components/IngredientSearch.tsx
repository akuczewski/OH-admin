import { useFetchClient, useForm } from '@strapi/admin/strapi-admin'; // Correct Strapi 5 standard import
import {
    Button,
    Combobox,
    ComboboxOption,
    Field,
    Flex
} from '@strapi/design-system';
import React, { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

export const Input = ({
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
    const [options, setOptions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchValue, setSearchValue] = useState(value || '');
    const { get, post } = useFetchClient();

    const [isCalculating, setIsCalculating] = useState(false);

    // Grab the current form values and the change handler using Strapi 5's selector signature
    const { values, onChange: onFormChange } = useForm('IngredientSearch', (state: any) => state);

    console.log('[MACRO-CALC V5.0 - STABILITY] Component Render. Values:', values, 'onChange exists:', !!onFormChange);

    const handleDebugForm = () => {
        console.log('--- [INGREDIENT-DEBUG V5.0 - STABILITY] FORM STATE ---');
        console.log('Values:', JSON.stringify(values, null, 2));
        console.log('onFormChange exists:', !!onFormChange);
        console.log('-----------------------------------------');
    };

    const setFormValue = (fieldName: string, val: any) => {
        if (onFormChange) {
            onFormChange({ target: { name: fieldName, value: val, type: 'string' } });
        }
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
            const ingredientsToCalculate = values.ingredients.map((ing: any) => ({
                name: ing.slug || ing.name,
                amount: ing.amount,
                unit: ing.unit
            }));

            console.log('[MACRO-CALC V5.0 - STABILITY] Sending request to API...');
            const { data: res } = await post('/ingredient-lookup/calculate-macros', {
                ingredients: ingredientsToCalculate
            });

            const result = res?.data || res;
            console.log('[MACRO-CALC V5.0 - STABILITY] Full API Response:', JSON.stringify(result));

            if (result && result.macros) {
                // Update kcal
                console.log('[MACRO-CALC V5.4 - REDUX FIX] Setting kcal:', result.kcal);
                setFormValue('kcal', result.kcal);

                // Ensure macros object exists in state
                if (!values.macros) {
                    console.log('[MACRO-CALC V5.4 - REDUX FIX] Initializing macros object in form state');
                    setFormValue('macros', { protein: 0, carbs: 0, fat: 0, fiber: 0 });
                }

                // Update macros component as a single object to ensure Strapi 5 sees it correctly
                console.log('[MACRO-CALC V5.4 - REDUX FIX] Attempting to set macros object:', JSON.stringify(result.macros));
                setFormValue('macros', result.macros);

                // Fallback: also try to set individual fields in case Strapi 5 requires it for nested state tracking
                setFormValue('macros.protein', result.macros.protein);
                setFormValue('macros.carbs', result.macros.carbs);
                setFormValue('macros.fat', result.macros.fat);
                setFormValue('macros.fiber', result.macros.fiber);

                console.log('[MACRO-CALC V5.4 - REDUX FIX] All form fields updated via Redux.');
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
            console.log('[MACRO-CALC V5.4 - REDUX FIX] Auto-triggering calculation.');
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
                // Primary: Try Content Manager API (Admin authenticated, perfectly matches relation field)
                const cmUrl = `/content-manager/collection-types/api::skladnik.skladnik?filters[name][$containsi]=${encodeURIComponent(searchValue)}&pagination[pageSize]=20`;
                console.log(`[INGREDIENT-SEARCH] Fetching CM API: ${cmUrl}`);
                let response: any;
                
                try {
                    response = await get(cmUrl);
                } catch (cmErr: any) {
                    console.error('[INGREDIENT-SEARCH] CM API Failed, trying plugin API...', cmErr);
                    // Fallback: Try plugin API
                    const pluginUrl = `/ingredient-lookup/search?q=${encodeURIComponent(searchValue)}`;
                    response = await get(pluginUrl);
                }

                console.log(`[INGREDIENT-SEARCH] API Raw Response:`, response);
                
                let items = response?.data?.results || response?.data?.data || response?.results || response?.data;
                const results = Array.isArray(items) ? items : [];
                
                if (results.length === 0) {
                     setOptions([{ id: 'debug1', documentId: 'debug1', name: `API ZWRÓCIŁO 0 WYNIKÓW DLA: ${searchValue}` }]);
                } else {
                     setOptions(results);
                }
                
                console.log(`[INGREDIENT-SEARCH] Found ${results.length} items`);
            } catch (err: any) {
                console.error('[INGREDIENT-SEARCH] Search error:', err.response || err);
                setOptions([{ id: 'err1', documentId: 'err1', name: `BŁĄD API: ${err.message}` }]);
            } finally {
                setIsLoading(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [searchValue, get]);

    // SMART SYNC: Detect if the relation field in this row was changed and update the name accordingly
    useEffect(() => {
        if (!values.ingredients || !Array.isArray(values.ingredients) || !name.includes('.')) return;
        
        const pathParts = name.split('.');
        const index = parseInt(pathParts[1], 10);
        if (isNaN(index)) return;

        const currentIng = values.ingredients[index];
        
        if (currentIng?.ingredient && !currentIng?.name) {
            console.log('[SMART-SYNC] Detected relation without name for row:', index);
            
            // Bulletproof docId extraction for Strapi 5 (handles strings, objects, and arrays)
            let docId = null;
            if (typeof currentIng.ingredient === 'string') {
                docId = currentIng.ingredient;
            } else if (Array.isArray(currentIng.ingredient) && currentIng.ingredient.length > 0) {
                docId = currentIng.ingredient[0].documentId || currentIng.ingredient[0].id;
            } else if (typeof currentIng.ingredient === 'object' && currentIng.ingredient !== null) {
                docId = currentIng.ingredient.documentId || currentIng.ingredient.id;
            }
                
            console.log('[SMART-SYNC] Extracted docId:', docId);
            const match = options.find((opt: any) => opt.documentId === docId || opt.id === docId);
            
            if (match) {
                console.log('[SMART-SYNC] Auto-filling name from match:', (match as any).name);
                onChange({ target: { name, value: (match as any).name, type: 'string' } });
                setSearchValue((match as any).name);
                const slugPath = name.replace('.name', '.slug');
                setFormValue(slugPath, (match as any).slug);
            } else if (docId) {
                // If it's not in the currently loaded options, fetch it explicitly
                console.log('[SMART-SYNC] Fetching explicitly for relation docId:', docId);
                get(`/content-manager/collection-types/api::skladnik.skladnik/${docId}`)
                    .then((resp: any) => {
                        let fetchedOpt = resp?.data?.data || resp?.data || resp?.results || resp;
                        if (fetchedOpt && fetchedOpt.name) {
                            console.log('[SMART-SYNC] Explicit fetch success:', fetchedOpt.name);
                            onChange({ target: { name, value: fetchedOpt.name, type: 'string' } });
                            setSearchValue(fetchedOpt.name);
                            const slugPath = name.replace('.name', '.slug');
                            setFormValue(slugPath, fetchedOpt.slug);
                        } else {
                            console.warn('[SMART-SYNC] Fetched structure was missing name:', fetchedOpt);
                        }
                    })
                    .catch((err: any) => {
                        console.error('[SMART-SYNC] Explicit fetch failed:', err);
                    });
            } else {
                console.warn('[SMART-SYNC] Could not extract docId from relation:', currentIng.ingredient);
            }
        }
    }, [JSON.stringify(values.ingredients)]);

    const handleInputChange = (e: any) => {
        // In some Strapi Design System versions, 'e' is a string. In others, it's an event.
        const val = typeof e === 'string' ? e : (e?.target?.value || '');
        console.log('[INGREDIENT-SEARCH] Input changing to:', val);
        setSearchValue(val);
    };

    const handleSelect = (selectedValue: string) => {
        // Update the primary name field
        onChange({ target: { name, value: selectedValue, type: 'string' } });

        // Update the hidden slug and relation fields if we find a match in the loaded options
        const match = options.find((opt: any) => opt.name === selectedValue);
        if (match && name.includes('.name')) {
            const slugPath = name.replace('.name', '.slug');
            const relPath = name.replace('.name', '.ingredient');
            
            console.log('[INGREDIENT-AUTO-REL] Setting slug:', (match as any).slug, 'and relation:', (match as any).documentId);
            setFormValue(slugPath, (match as any).slug);
            setFormValue(relPath, (match as any).documentId);
        }
    };

    const label = intlLabel?.id
        ? formatMessage(intlLabel)
        : (intlLabel?.defaultMessage || name);

    const hint = description?.id
        ? formatMessage(description)
        : (description?.defaultMessage || description || '');

    const errorMessage = error?.id
        ? formatMessage(error)
        : (error?.defaultMessage || error || '');

    return (
        <Field.Root name={name} id={name} error={errorMessage} hint={hint} required={required}>
            <Flex justifyContent="space-between" alignItems="center" marginBottom={1}>
                <Field.Label>{label}</Field.Label>
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
                filterValue=""
            >
                {options.map((opt: any) => (
                    <ComboboxOption key={opt.documentId || opt.id} value={opt.name}>
                        {opt.name} ({opt.category || 'składnik'})
                    </ComboboxOption>
                ))}
            </Combobox>
            <Field.Hint />
            <Field.Error />
        </Field.Root>
    );
};

// export default IngredientLookup; // Removed default export to match expected Input from app.tsx
