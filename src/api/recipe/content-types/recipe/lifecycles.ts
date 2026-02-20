
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

            let weightInGrams = 0;
            const unit = ing.unit || 'g';
            const amount = parseFloat(ing.amount) || 0;

            if (UNIT_CONVERSIONS[unit]) {
                weightInGrams = amount * UNIT_CONVERSIONS[unit];
            } else if (unit === 'szt' || unit === 'opakowanie') {
                weightInGrams = amount * (nutrition.averagePieceWeight || 100); // Fallback to 100g if unknown
            } else {
                weightInGrams = amount; // Default to 1:1
            }

            const factor = weightInGrams / 100;

            totalKcal += (nutrition.kcal || 0) * factor;
            totalProtein += (nutrition.protein || 0) * factor;
            totalCarbs += (nutrition.carbs || 0) * factor;
            totalFat += (nutrition.fat || 0) * factor;
            totalFiber += (nutrition.fiber || 0) * factor;

            console.log(`[MACRO-CALC] Added ${ing.name}: ${weightInGrams}g -> ${(nutrition.kcal * factor).toFixed(1)} kcal`);
        } catch (err) {
            console.error(`[MACRO-CALC] Error fetching ingredient ${ing.name}:`, err);
        }
    }

    // Update the data object
    data.kcal = Math.round(totalKcal);
    data.macros = {
        protein: Math.round(totalProtein),
        carbs: Math.round(totalCarbs),
        fat: Math.round(totalFat),
        fiber: Math.round(totalFiber),
    };

    console.log(`[MACRO-CALC] Final: ${data.kcal} kcal, P:${data.macros.protein}g, C:${data.macros.carbs}g, F:${data.macros.fat}g`);
}

export default {
    async beforeCreate(event: any) {
        await calculateRecipeMacros(event.params.data);
    },

    async beforeUpdate(event: any) {
        // In beforeUpdate, event.params.data might be a partial update
        // We only recalculate if ingredients are being updated
        if (event.params.data.ingredients) {
            await calculateRecipeMacros(event.params.data);
        }
    },
};
