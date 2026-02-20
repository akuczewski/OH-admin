
import { db } from '../../../../lib/firebase';

const UNIT_CONVERSIONS: Record<string, number> = {
    'g': 1,
    'ml': 1,
    'lyzka': 15,
    'lyzeczka': 5,
    'szklanka': 250,
    'szczypta': 1,
    'garstka': 30,
    'plaster': 20, // Default estimate if averagePieceWeight is missing
};

async function calculateRecipeMacros(data: any) {
    if (!data.ingredients || !Array.isArray(data.ingredients)) {
        return;
    }

    let totalKcal = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;

    console.log(`[MACRO-CALC] Calculating for recipe: ${data.name}`);

    for (const ing of data.ingredients) {
        if (!ing.name || !ing.amount) continue;

        try {
            // ing.name is the slug/ID in Firebase
            const doc = await db.collection('ingredients').doc(ing.name).get();

            if (!doc.exists) {
                console.warn(`[MACRO-CALC] Ingredient not found in Firebase: ${ing.name}`);
                continue;
            }

            const nutrition = doc.data();
            if (!nutrition) continue;

            let factor = 0;
            const unit = ing.unit || 'g';
            const amount = parseFloat(ing.amount) || 0;

            if (nutrition.unitType === 'piece') {
                if (unit === 'szt' || unit === 'opakowanie') {
                    factor = amount;
                } else if (UNIT_CONVERSIONS[unit]) {
                    const weightInGrams = amount * UNIT_CONVERSIONS[unit];
                    factor = weightInGrams / (nutrition.averagePieceWeight || 100);
                } else {
                    factor = amount;
                }
            } else {
                let weightInGrams = 0;
                if (UNIT_CONVERSIONS[unit]) {
                    weightInGrams = amount * UNIT_CONVERSIONS[unit];
                } else if (unit === 'szt' || unit === 'opakowanie') {
                    weightInGrams = amount * (nutrition.averagePieceWeight || 100);
                } else {
                    weightInGrams = amount;
                }
                factor = weightInGrams / 100;
            }

            totalKcal += (nutrition.kcal || 0) * factor;
            totalProtein += (nutrition.protein || 0) * factor;
            totalCarbs += (nutrition.carbs || 0) * factor;
            totalFat += (nutrition.fat || 0) * factor;
            totalFiber += (nutrition.fiber || 0) * factor;

            console.log(`[MACRO-CALC] Added ${ing.name}: amount ${amount} ${unit} -> ${(nutrition.kcal * factor).toFixed(1)} kcal`);
        } catch (err) {
            console.error(`[MACRO-CALC] Error fetching ingredient ${ing.name}:`, err);
        }
    }

    // Return the calculated data instead of mutating
    return {
        kcal: Math.round(totalKcal),
        macros: {
            protein: Math.round(totalProtein),
            carbs: Math.round(totalCarbs),
            fat: Math.round(totalFat),
            fiber: Math.round(totalFiber),
        }
    };
}

export default {
    async afterCreate(event: any) {
        const { result } = event;
        if (!result || !result.ingredients) return;

        const calculated = await calculateRecipeMacros(result);
        if (calculated) {
            try {
                await strapi.documents('api::recipe.recipe').update({
                    documentId: result.documentId,
                    data: {
                        kcal: calculated.kcal,
                        macros: calculated.macros,
                    },
                });
                console.log(`[MACRO-CALC] Successfully attached macros to new recipe ${result.documentId}`);
            } catch (err) {
                console.error('[MACRO-CALC] Failed to update recipe during afterCreate:', err);
            }
        }
    },

    async afterUpdate(event: any) {
        const { result, params } = event;
        // Only run if ingredients were changed (they will be in params.data)
        // or if the result itself has ingredients (meaning they were part of the update)
        if (!result || (!params.data?.ingredients && !result.ingredients)) return;

        // Use result for calculation as it contains the full, updated entry
        const calculated = await calculateRecipeMacros(result);
        if (calculated) {
            // Check if values actually changed to prevent loop
            const isSameKcal = result.kcal === calculated.kcal;
            const isSameMacros = result.macros &&
                result.macros.protein === calculated.macros.protein &&
                result.macros.carbs === calculated.macros.carbs &&
                result.macros.fat === calculated.macros.fat &&
                result.macros.fiber === calculated.macros.fiber;

            if (isSameKcal && isSameMacros) {
                console.log(`[MACRO-CALC] Macros identical for ${result.documentId}, skipping update.`);
                return;
            }

            try {
                // Determine existing macro component ID if any
                const existingMacros = result.macros ? { id: result.macros.id, ...calculated.macros } : calculated.macros;

                await strapi.documents('api::recipe.recipe').update({
                    documentId: result.documentId,
                    data: {
                        kcal: calculated.kcal,
                        macros: existingMacros,
                    },
                });
                console.log(`[MACRO-CALC] Successfully updated macros for recipe ${result.documentId}`);
            } catch (err) {
                console.error('[MACRO-CALC] Failed to update recipe during afterUpdate:', err);
            }
        }
    },
};
