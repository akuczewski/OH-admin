
import { db } from '../../../lib/firebase';

export default {
    async search(ctx) {
        const { q } = ctx.query;

        if (!q || q.length < 2) {
            return ctx.badRequest('Query string "q" is required and must be at least 2 characters long');
        }

        try {
            const queryText = q.toLowerCase();

            // Firestore doesn't support partial text search out of the box (like ILIKE %q%)
            // But we can do a prefix search if we have slugs or exact matches.
            // For a better experience, we'll fetch all ingredients (there's only ~1000)
            // and filter them in memory, or just do a startAt/endAt prefix search.

            // Option: Prefix search on slug
            const snapshot = await db.collection('ingredients')
                .where('slug', '>=', queryText)
                .where('slug', '<=', queryText + '\uf8ff')
                .limit(20)
                .get();

            const results = snapshot.docs.map(doc => doc.data());

            // If we don't have enough results or want better matching, we could search by name too
            // but Firestore is limited here. Since we only have 100-1000 items, 
            // simple prefix search on slug is a good start.

            return results;
        } catch (error) {
            console.error('[INGREDIENT SEARCH] Error:', error);
            return ctx.internalServerError('Failed to search ingredients');
        }
    },
};
