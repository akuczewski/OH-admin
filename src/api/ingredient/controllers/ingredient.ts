
import { db } from '../../../lib/firebase';

const UNIT_CONVERSIONS: Record<string, number> = {
    'g': 1,
    'ml': 1,
    'lyzka': 15,
    'lyzeczka': 5,
    'szklanka': 250,
    'szczypta': 1,
    'garstka': 30,
    'plaster': 20,
};

export default {
    async search(ctx) {
        const { q } = ctx.query;
        console.log(`[INGREDIENT SEARCH] Query: "${q}"`);

        if (!q || q.length < 2) {
            return ctx.badRequest('Query string "q" is required and must be at least 2 characters long');
        }

        try {
            const queryText = q.toLowerCase();
            // Prefix search on slug
            const snapshot = await db.collection('ingredients')
                .where('slug', '>=', queryText)
                .where('slug', '<=', queryText + '\uf8ff')
                .limit(20)
                .get();

            const results = snapshot.docs.map(doc => doc.data());
            console.log(`[INGREDIENT SEARCH] Found ${results.length} results for "${q}"`);

            return results;
        } catch (error) {
            console.error('[INGREDIENT SEARCH] Error:', error);
            return ctx.internalServerError('Failed to search ingredients');
        }
    },

    async calculateMacros(ctx) {
        const { ingredients } = ctx.request.body;
        console.log('[MACRO-CALC] API Request for ingredients:', JSON.stringify(ingredients));

        if (!ingredients || !Array.isArray(ingredients)) {
            return ctx.badRequest('Expected an array of ingredients');
        }

        let totalKcal = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        let totalFiber = 0;

        for (const ing of ingredients) {
            if (!ing.name || !ing.amount) continue;

            try {
                // Try direct lookup by name as ID first
                let doc = await db.collection('ingredients').doc(ing.name).get();
                let nutrition = doc.data();

                // If not found by ID, search by 'name' field
                if (!doc.exists) {
                    const snapshot = await db.collection('ingredients').where('name', '==', ing.name).limit(1).get();
                    if (!snapshot.empty) {
                        doc = snapshot.docs[0];
                        nutrition = doc.data();
                    }
                }

                if (!doc.exists || !nutrition) continue;

                let factor = 0;
                const unit = ing.unit || 'g';
                const amount = parseFloat(ing.amount) || 0;

                if (nutrition.unitType === 'piece') {
                    // Firebase piece logic: macros are given per 1 piece
                    // If recipe unit is 'szt' or 'opakowanie', amount is pieces
                    if (unit === 'szt' || unit === 'opakowanie') {
                        factor = amount;
                    } else if (UNIT_CONVERSIONS[unit]) {
                        // User chose a weight unit for a piece-based ingredient?
                        // E.g. 50g of Pineapple. We need averagePieceWeight to convert.
                        const weightInGrams = amount * UNIT_CONVERSIONS[unit];
                        factor = weightInGrams / (nutrition.averagePieceWeight || 100);
                    } else {
                        factor = amount;
                    }
                } else {
                    // Firebase weight logic: macros are given per 100g
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
            } catch (err) {
                console.error(`[MACRO-CALC] Error fetching ingredient ${ing.name}:`, err);
            }
        }

        return {
            kcal: Math.round(totalKcal),
            macros: {
                protein: Math.round(totalProtein),
                carbs: Math.round(totalCarbs),
                fat: Math.round(totalFat),
                fiber: Math.round(totalFiber),
            }
        };
    },
};
