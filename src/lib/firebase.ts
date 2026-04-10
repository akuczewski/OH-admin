import admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;
        if (privateKey) {
            privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                project_id: process.env.FIREBASE_PROJECT_ID,
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                private_key: privateKey,
            } as any),
        });
        console.log('[FIREBASE] Admin SDK initialized successfully.');
    } catch (error) {
        console.error('[FIREBASE] Admin SDK initialization failed:', error);
    }
}

let db: admin.firestore.Firestore | undefined;
try {
    if (admin.apps.length > 0) {
        db = admin.firestore();
        db.settings({ ignoreUndefinedProperties: true });
    }
} catch (e) {
    console.warn('[FIREBASE] Firestore access disabled.');
}

export { db };
export default admin;
