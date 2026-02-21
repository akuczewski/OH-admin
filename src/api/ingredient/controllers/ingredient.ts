
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
        console.log('[MACRO-CALC-V5] API Request for ingredients:', JSON.stringify(ingredients));

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

            const searchId = ing.slug || ing.name;

            try {
                // Try direct lookup by slug/name as ID
                let doc = await db.collection('ingredients').doc(searchId).get();
                let nutrition = doc.data();

                // Fallback: search by 'name' field
                if (!doc.exists) {
                    const snapshot = await db.collection('ingredients').where('name', '==', ing.name).limit(1).get();
                    if (!snapshot.empty) {
                        doc = snapshot.docs[0];
                        nutrition = doc.data();
                    }
                }

                // Secondary fallback: search by 'slug' field
                if (!doc.exists && ing.slug) {
                    const snapshot = await db.collection('ingredients').where('slug', '==', ing.slug).limit(1).get();
                    if (!snapshot.empty) {
                        doc = snapshot.docs[0];
                        nutrition = doc.data();
                    }
                }

                if (!doc.exists || !nutrition) {
                    console.warn(`[MACRO-CALC-V5] NOT FOUND: "${ing.name}"`);
                    continue;
                }

                console.log(`[MACRO-CALC-V5] Success for "${ing.name}"`);

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
            } catch (err) {
                console.error(`[MACRO-CALC-V5] Controller Error ${ing.name}:`, err);
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
