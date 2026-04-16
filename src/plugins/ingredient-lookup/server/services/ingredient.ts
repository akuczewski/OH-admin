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

        let totalKcal = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        let totalFiber = 0;

        for (const ing of ingredients) {
            // Find the ingredient details by slug or name if id is missing
            let item: any = null;
            if (ing.slug) {
                // @ts-ignore
                const results = await (strapi as any).documents('api::skladnik.skladnik').findMany({
                    filters: { slug: ing.slug } as any,
                    limit: 1
                });
                item = results[0];
            } else if (ing.name) {
                // @ts-ignore
                const results = await (strapi as any).documents('api::skladnik.skladnik').findMany({
                    filters: { name: ing.name } as any,
                    limit: 1
                });
                item = results[0];
            }

            if (item) {
                const amount = parseFloat(ing.amount) || 0;
                const multiplier = amount / 100;
                
                totalKcal += (item.kcal || 0) * multiplier;
                totalProtein += (item.protein || 0) * multiplier;
                totalCarbs += (item.carbs || 0) * multiplier;
                totalFat += (item.fat || 0) * multiplier;
                totalFiber += (item.fiber || 0) * multiplier;
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
