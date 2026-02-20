import { Button } from '@strapi/design-system';
// @ts-ignore
import { useCMEditViewDataManager, useFetchClient } from '@strapi/strapi/admin';
import { useState } from 'react';

const RecalculateButton = () => {
    const { modifiedData, onChange } = useCMEditViewDataManager();
    const { post } = useFetchClient();
    const [isCalculating, setIsCalculating] = useState(false);

    // Only show button for Recipes
    if (!modifiedData?.ingredients) {
        return null;
    }

    const handleCalculateMacros = async () => {
        const ingredients = modifiedData.ingredients;
        if (!ingredients || !Array.isArray(ingredients)) return;

        setIsCalculating(true);
        try {
            const { data } = await post('/api/ingredients/calculate-macros', {
                ingredients
            });

            const result = data?.data || data;

            if (result && result.macros) {
                console.log('[MACRO-CALC-GLOBAL] Updating frontend form with macros:', result);

                // React Hook Form / Formik string path style updates for Strapi 5
                onChange({ target: { name: 'kcal', value: result.kcal, type: 'integer' } }, true);

                if (!modifiedData.macros) {
                    onChange({ target: { name: 'macros', value: result.macros, type: 'component' } }, true);
                } else {
                    onChange({ target: { name: 'macros.protein', value: result.macros.protein, type: 'integer' } }, true);
                    onChange({ target: { name: 'macros.carbs', value: result.macros.carbs, type: 'integer' } }, true);
                    onChange({ target: { name: 'macros.fat', value: result.macros.fat, type: 'integer' } }, true);
                    onChange({ target: { name: 'macros.fiber', value: result.macros.fiber, type: 'integer' } }, true);
                }
            }
        } catch (err) {
            console.error('[MACRO-CALC-GLOBAL] Failed to calculate macros:', err);
        } finally {
            setIsCalculating(false);
        }
    };

    return (
        <Button
            variant="secondary"
            onClick={handleCalculateMacros}
            loading={isCalculating}
            fullWidth
        >
            Przelicz makra
        </Button>
    );
};

export default RecalculateButton;
