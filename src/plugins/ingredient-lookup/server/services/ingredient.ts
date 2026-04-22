import { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
    async search(query: string) {
        console.log('[INGREDIENT-SERVICE] Searching for:', query);
        
        // Use document service for Strapi 5 - cast to any to bypass strict plugin type check
        const results = await (strapi as any).documents('api::skladnik.skladnik').findMany({
            filters: {
                $or: [
                    { name: { $containsi: query } },
                    { slug: { $containsi: query } },
                ] as any,
            },
            limit: 20,
        });

        // Map results to the format expected by the frontend
        return results.map((item: any) => ({
            id: item.id,
            documentId: item.documentId,
            name: item.name,
            slug: item.slug,
            category: item.category || 'inne',
            macros: {
                kcal: item.kcal,
                protein: item.protein,
                carbs: item.carbs,
                fat: item.fat,
                fiber: item.fiber,
            }
        }));
    },

    async calculateMacros(ingredients: any[]) {
        if (!ingredients || !Array.isArray(ingredients)) return null;

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

        let totalKcal = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        let totalFiber = 0;

        for (const ing of ingredients) {
            let item: any = null;
            // Lookup by slug, name or documentId
            if (ing.documentId) {
                item = await (strapi as any).documents('api::skladnik.skladnik').findOne({ documentId: ing.documentId });
            } else if (ing.slug) {
                const results = await (strapi as any).documents('api::skladnik.skladnik').findMany({
                    filters: { slug: ing.slug } as any,
                    limit: 1
                });
                item = results[0];
            } else if (ing.name) {
                const results = await (strapi as any).documents('api::skladnik.skladnik').findMany({
                    filters: { name: ing.name } as any,
                    limit: 1
                });
                item = results[0];
            }

            if (item) {
                const amount = parseFloat(String(ing.amount || '0').replace(',', '.')) || 0;
                const unit = (ing.unit || 'g').toLowerCase();
                let factor = 0;

                if (ing.weight && ing.weight > 0) {
                    // Priorytet: pole weight wypełnione przez parser (bezpośrednia waga w gramach)
                    factor = Number(ing.weight) / 100;
                } else if (item.unitType === 'piece') {
                    if (unit === 'szt' || unit === 'opakowanie') {
                        factor = amount;
                    } else if (UNIT_CONVERSIONS[unit]) {
                        factor = (amount * UNIT_CONVERSIONS[unit]) / (Number(item.averagePieceWeight) || 100);
                    } else {
                        factor = amount;
                    }
                } else {
                    let weightInGrams = 0;
                    if (UNIT_CONVERSIONS[unit]) {
                        weightInGrams = amount * UNIT_CONVERSIONS[unit];
                    } else if (unit === 'szt' || unit === 'opakowanie') {
                        weightInGrams = amount * (Number(item.averagePieceWeight) || 100);
                    } else {
                        weightInGrams = amount;
                    }
                    factor = weightInGrams / 100;
                }
                
                totalKcal += (Number(item.kcal) || 0) * factor;
                totalProtein += (Number(item.protein) || 0) * factor;
                totalCarbs += (Number(item.carbs) || 0) * factor;
                totalFat += (Number(item.fat) || 0) * factor;
                totalFiber += (Number(item.fiber) || 0) * factor;
            }
        }

        return {
            kcal: Math.round(totalKcal),
            macros: {
                protein: Number(totalProtein.toFixed(1)),
                carbs: Number(totalCarbs.toFixed(1)),
                fat: Number(totalFat.toFixed(1)),
                fiber: Number(totalFiber.toFixed(1)),
            }
        };
    }
});
