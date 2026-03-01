const { admin, db } = require('../firebase.js');
const { connectRedis, connectRedisSummary } = require('../config/redis.config');

let redisConnectionClient;
let redisSummaryClient;
let batchQueue = new Map(); // Collection -> Map of docId -> data
let isProcessing = false;

(async () => {
    redisConnectionClient = await connectRedis();
    redisSummaryClient = await connectRedisSummary();
})();

// Flush all pending writes to Firestore
const flushBatchToFirestore = async () => {
    if (isProcessing || batchQueue.size === 0) return;

    isProcessing = true;
    // console.log(`[BatchWriter] Starting batch flush with ${batchQueue.size} collections`);

    try {
        const batch = db.batch();
        let operationCount = 0;

        for (const [collection, docs] of batchQueue.entries()) {
            for (const [docId, data] of docs.entries()) {
                const docRef = db.collection(collection).doc(docId);
                batch.set(docRef, data, { merge: true });
                operationCount++;
            }
        }

        if (operationCount > 0) {
            await batch.commit();
            // console.log(`[BatchWriter] Successfully flushed ${operationCount} operations to Firestore`);
        }

        // Clear the queue after successful flush
        batchQueue.clear();

    } catch (error) {
        console.error('[BatchWriter] Error flushing batch to Firestore:', error);
        // Keep the queue intact for retry
    } finally {
        isProcessing = false;
    }
};

// Deep-merge helper for plain objects (shallow merge for nested plain objects)
const mergeObjects = (target, source) => {
    const out = { ...(target || {}) };
    for (const [k, v] of Object.entries(source || {})) {
        if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] !== null && !Array.isArray(out[k])) {
            out[k] = { ...(out[k] || {}), ...(v || {}) };
        } else {
            out[k] = v;
        }
    }
    return out;
};

// Add data to batch queue, merging with any existing queued data for the same doc
const addToBatch = (collection, docId, data) => {
    if (!batchQueue.has(collection)) {
        batchQueue.set(collection, new Map());
    }
    const docs = batchQueue.get(collection);
    if (docs.has(docId)) {
        const existing = docs.get(docId);
        const merged = mergeObjects(existing, data);
        docs.set(docId, merged);
    } else {
        docs.set(docId, data);
    }
    // console.log(`[BatchWriter] Added/merged ${collection}/${docId} to batch queue`);
};

// Store data immediately in Redis and queue for Firestore
const storeData = async (collection, docId, data, redisKey = null, ttl = 86400) => {
    try {
        // Store in Redis immediately
        if (redisConnectionClient && redisKey) {
            await redisConnectionClient.set(redisKey, JSON.stringify(data), { EX: ttl });
        }

        // Add to batch queue for Firestore
        addToBatch(collection, docId, data);

        return { success: true, cached: true };
    } catch (error) {
        console.error(`[BatchWriter] Error storing data for ${collection}/${docId}:`, error);
        return { success: false, error: error.message };
    }
};

// Store user data with proper Redis keys
const storeUserData = async (userId, data, ttl = 1728000) => { // 20 days default
    try {
        // console.log(`[BatchWriter] Storing user data for ${userId}:`, data);

        if (redisConnectionClient) {
            // Store main user profile fields ONLY if provided to avoid clearing existing values
            const userProfileData = {};
            if (Object.prototype.hasOwnProperty.call(data, 'name')) userProfileData.name = data.name || '';
            if (Object.prototype.hasOwnProperty.call(data, 'age')) userProfileData.age = String(data.age || '');
            if (Object.prototype.hasOwnProperty.call(data, 'gender')) userProfileData.gender = data.gender || '';
            if (Object.prototype.hasOwnProperty.call(data, 'email')) userProfileData.email = data.email || '';
            if (Object.prototype.hasOwnProperty.call(data, 'photo')) userProfileData.photo = data.photo || '';
            if (Object.prototype.hasOwnProperty.call(data, 'course')) {
                userProfileData.hasCourse = String(Array.isArray(data.course) && data.course.length > 0);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'MaxTokens')) {
                // Store in hash for quick retrieval
                userProfileData.MaxTokens = String(data.MaxTokens || 0);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'interests')) {
                userProfileData.hasInterests = String(Array.isArray(data.interests) && data.interests.length > 0);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'personalDetailsAdded')) {
                userProfileData.personalDetailsAdded = String(!!data.personalDetailsAdded);
            }

            if (Object.keys(userProfileData).length > 0) {
                await redisConnectionClient.hSet(`user:${userId}`, userProfileData);
                await redisConnectionClient.expire(`user:${userId}`, ttl);
            }
            // Also store dedicated MaxTokens key if provided
            if (Object.prototype.hasOwnProperty.call(data, 'MaxTokens')) {
                await redisConnectionClient.set(`MaxTokens:${userId}`, String(data.MaxTokens || 0), { EX: ttl });
            }

            // Store arrays separately
            if (Object.prototype.hasOwnProperty.call(data, 'interests')) {
                await redisConnectionClient.set(`interests:${userId}`, JSON.stringify(data.interests), { EX: ttl });
            }
            if (Object.prototype.hasOwnProperty.call(data, 'course')) {
                await redisConnectionClient.set(`course:${userId}`, JSON.stringify(data.course), { EX: ttl });
            }
            if (Object.prototype.hasOwnProperty.call(data, 'subjects')) {
                await redisConnectionClient.set(`subjects:${userId}`, JSON.stringify(data.subjects), { EX: ttl });
            }
            if (Object.prototype.hasOwnProperty.call(data, 'activity')) {
                await redisConnectionClient.set(`activity:${userId}`, JSON.stringify(data.activity), { EX: ttl });
            }
            if (Object.prototype.hasOwnProperty.call(data, 'savedPlaylists')) {
                await redisConnectionClient.set(`savedPlaylists:${userId}`, JSON.stringify(data.savedPlaylists), { EX: ttl });
            }

            // Store statistics
            if (Object.prototype.hasOwnProperty.call(data, 'totalActiveDays')) {
                await redisConnectionClient.set(`totalActiveDays:${userId}`, String(data.totalActiveDays), { EX: ttl });
            }
            if (Object.prototype.hasOwnProperty.call(data, 'maxStreak')) {
                await redisConnectionClient.set(`maxStreak:${userId}`, String(data.maxStreak), { EX: ttl });
            }
            if (Object.prototype.hasOwnProperty.call(data, 'currentStreak')) {
                await redisConnectionClient.set(`currentStreak:${userId}`, String(data.currentStreak), { EX: ttl });
            }
            if (Object.prototype.hasOwnProperty.call(data, 'videosWatched')) {
                await redisConnectionClient.set(`videosWatched:${userId}`, String(data.videosWatched), { EX: ttl });
            }
            if (Object.prototype.hasOwnProperty.call(data, 'videosInLastWeek')) {
                await redisConnectionClient.set(`videosInLastWeek:${userId}`, String(data.videosInLastWeek), { EX: 604800 }); // 7 days
            }
        }

        // Add to batch queue for Firestore
        // If token fields are present, store them under a single nested object: tokenUsage
        const TOKEN_FIELDS = ['quizTokens', 'irTokens', 'totalTokens', 'chatBotTokens'];
        const hasTokenField = TOKEN_FIELDS.some((k) => Object.prototype.hasOwnProperty.call(data, k));

        // Destructure to separate token fields and any existing tokenUsage map
        const { quizTokens, irTokens, totalTokens, chatBotTokens, tokenUsage: tokenUsageFromCaller, ...rest } = data;

        if (hasTokenField || (tokenUsageFromCaller && typeof tokenUsageFromCaller === 'object')) {
            const tokenUsage = { ...(tokenUsageFromCaller || {}) };
            if (Object.prototype.hasOwnProperty.call(data, 'quizTokens')) tokenUsage.quizTokens = quizTokens;
            if (Object.prototype.hasOwnProperty.call(data, 'irTokens')) tokenUsage.irTokens = irTokens;
            if (Object.prototype.hasOwnProperty.call(data, 'totalTokens')) tokenUsage.totalTokens = totalTokens;
            if (Object.prototype.hasOwnProperty.call(data, 'chatBotTokens')) tokenUsage.chatBotTokens = chatBotTokens;

            const firestoreData = { ...rest, tokenUsage, lastUpdated: admin.firestore.FieldValue.serverTimestamp() };
            addToBatch('Users', userId, firestoreData);
        } else {
            addToBatch('Users', userId, data);
        }

        return { success: true, cached: true };
    } catch (error) {
        console.error(`[BatchWriter] Error storing user data for ${userId}:`, error);
        return { success: false, error: error.message };
    }
};

// Store notes data
const storeNotesData = async (userId, videoId, content, ttl = 86400) => {
    try {
        const noteData = {
            content: content || "",
            timestamp: new Date().toISOString(),
            videoId
        };

        if (redisConnectionClient) {
            try {
                // Use a Redis hash per user to store per-video note entries as JSON strings
                // This prevents replacing the whole key when a single video note is saved
                await redisConnectionClient.hSet(`notes:${userId}`, videoId, JSON.stringify(noteData));
                await redisConnectionClient.expire(`notes:${userId}`, ttl);
            } catch (cacheErr) {
                // If we get WRONGTYPE error, delete the old key and retry with hash
                if (cacheErr.message && cacheErr.message.includes('WRONGTYPE')) {
                    console.error('[BatchWriter] Redis key type mismatch for notes, deleting and retrying:', cacheErr.message);
                    try {
                        await redisConnectionClient.del(`notes:${userId}`);
                        await redisConnectionClient.hSet(`notes:${userId}`, videoId, JSON.stringify(noteData));
                        await redisConnectionClient.expire(`notes:${userId}`, ttl);
                    } catch (retryErr) {
                        console.error('[BatchWriter] Failed to retry after deleting old key:', retryErr.message || retryErr);
                    }
                } else {
                    console.error('[BatchWriter] Failed to update Redis hash for notes:', cacheErr.message || cacheErr);
                }
            }
        }

        // For Firestore, we need to get existing notes and update
        const userRef = db.collection('Users').doc(userId);
        const docSnap = await userRef.get();
        let notes = {};

        if (docSnap.exists) {
            const data = docSnap.data();
            notes = data.notes || {};
        }

        notes[videoId] = {
            content: content || "",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            videoId
        };

        addToBatch('Users', userId, { notes });

        return { success: true, cached: true };
    } catch (error) {
        console.error(`[BatchWriter] Error storing notes for ${userId}/${videoId}:`, error);
        return { success: false, error: error.message };
    }
};

// Store summary data
const storeSummaryData = async (videoId, summary, ttl = 14400) => { // 4 hours
    try {
        const summaryData = {
            summary,
            videoId,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };
        // Store in Redis immediately
        if (redisSummaryClient) {
            await redisSummaryClient.set(`summary:${videoId}`, summary, { EX: ttl });
        }

        // Add to batch queue for Firestore (batched write every 4 hours)
        addToBatch('Summaries', videoId, summaryData);

        return { success: true, cached: true };
    } catch (error) {
        console.error(`[BatchWriter] Error storing summary for ${videoId}:`, error);
        return { success: false, error: error.message };
    }
};

// Store recommendation data (Redis only, no Firestore)
const storeRecommendationData = async (videoId, recommendations, ttl = 172800) => { // 2 days
    try {
        if (redisSummaryClient) {
            await redisSummaryClient.set(`recommendations:${videoId}`, JSON.stringify(recommendations), { EX: ttl });
        }

        return { success: true, cached: true };
    } catch (error) {
        console.error(`[BatchWriter] Error storing recommendations for ${videoId}:`, error);
        return { success: false, error: error.message };
    }
};

// Store blueprint data
const storeBlueprintData = async (userId, blueprintId, blueprintData, ttl = 604800) => { // 7 days default
    try {
        // Store in Redis immediately with TTL using hash structure
        if (redisConnectionClient) {
            const redisKey = `blueprints:${userId}`;
            await redisConnectionClient.hSet(redisKey, blueprintId, JSON.stringify(blueprintData));
            await redisConnectionClient.expire(redisKey, ttl);
            console.log(`[BatchWriter] Blueprint cached in Redis: ${redisKey} -> ${blueprintId}`);
        }
        
        // Store directly in Firestore instead of batching (due to subcollection structure)
        const docRef = db.collection('blueprints').doc(userId).collection('userBlueprints').doc(blueprintId);
        await docRef.set(blueprintData, { merge: true });
        console.log(`[BatchWriter] Blueprint saved to Firestore: blueprints/${userId}/userBlueprints/${blueprintId}`);
        
        return { success: true, cached: true, blueprintId };
    } catch (error) {
        console.error(`[BatchWriter] Error storing blueprint for ${userId}/${blueprintId}:`, error);
        return { success: false, error: error.message };
    }
};

// Update blueprint module in batch queue
const updateBlueprintModule = async (userId, blueprintId, moduleName, content, ttl = 604800) => {
    try {
        // Invalidate Redis cache for this specific blueprint
        if (redisConnectionClient) {
            const redisKey = `blueprints:${userId}`;
            await redisConnectionClient.hDel(redisKey, blueprintId);
            console.log(`[BatchWriter] Redis cache invalidated for: ${redisKey} -> ${blueprintId}`);
        }
        
        // Update Firestore directly (due to subcollection structure)
        const docRef = db.collection('blueprints').doc(userId).collection('userBlueprints').doc(blueprintId);
        const updateData = {
            [`modules.${moduleName}.content`]: content,
            updatedAt: Date.now()
        };
        await docRef.update(updateData);
        console.log(`[BatchWriter] Blueprint module updated in Firestore: ${userId}/${blueprintId}/${moduleName}`);
        
        return { success: true };
    } catch (error) {
        console.error(`[BatchWriter] Error updating blueprint module for ${userId}/${blueprintId}:`, error);
        return { success: false, error: error.message };
    }
};

// Delete blueprint from Redis and mark for deletion in Firestore
const deleteBlueprintData = async (userId, blueprintId) => {
    try {
        // Delete from Redis immediately (remove hash field)
        if (redisConnectionClient) {
            const redisKey = `blueprints:${userId}`;
            await redisConnectionClient.hDel(redisKey, blueprintId);
            console.log(`[BatchWriter] Blueprint deleted from Redis: ${redisKey} -> ${blueprintId}`);
        }
        
        // For deletion, we need to do it immediately in Firestore (can't batch delete)
        const docRef = db.collection('blueprints').doc(userId).collection('userBlueprints').doc(blueprintId);
        await docRef.delete();
        
        return { success: true };
    } catch (error) {
        console.error(`[BatchWriter] Error deleting blueprint for ${userId}/${blueprintId}:`, error);
        return { success: false, error: error.message };
    }
};

// Store notebook data
const storeNotebookData = async (userId, notebookName, content, isDelete = false) => {
    try {
        // For Firestore, we update the 'notebooks' map field in the User document
        // Key is notebookName, Value is content

        let updateData = {};

        if (isDelete) {
            updateData = {
                [`notebooks.${notebookName}`]: admin.firestore.FieldValue.delete()
            };
        } else {
            updateData = {
                [`notebooks.${notebookName}`]: content
            };
        }

        // We use dot notation for nested field updates in Firestore
        // However, batchWriter uses set with merge: true. 
        // To update a specific key in a map without overwriting the whole map, 
        // we need to construct the object structure if we are using set({ merge: true }) 
        // OR use update() which supports dot notation.
        // batchWriter implementation uses batch.set(docRef, data, { merge: true });
        // So we should structure it as { notebooks: { [notebookName]: content } }

        if (isDelete) {
            // For deletion within a map using set+merge, we need FieldValue.delete()
            addToBatch('Users', userId, {
                notebooks: {
                    [notebookName]: admin.firestore.FieldValue.delete()
                },
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            addToBatch('Users', userId, {
                notebooks: {
                    [notebookName]: content
                },
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        return { success: true, queued: true };
    } catch (error) {
        console.error(`[BatchWriter] Error storing notebook data for ${userId}/${notebookName}:`, error);
        return { success: false, error: error.message };
    }
};

// Start the batch processing timer (every 4 hours)
setInterval(flushBatchToFirestore, 4 * 60 * 60 * 1000);

// Also flush on process exit
process.on('SIGINT', async () => {
    // console.log('[BatchWriter] Process exiting, flushing remaining batch...');
    await flushBatchToFirestore();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    // console.log('[BatchWriter] Process terminating, flushing remaining batch...');
    await flushBatchToFirestore();
    process.exit(0);
});

module.exports = {
    storeData,
    storeUserData,
    storeNotesData,
    storeSummaryData,
    storeRecommendationData,
    storeNotebookData,
    storeBlueprintData,
    updateBlueprintModule,
    deleteBlueprintData,
    flushBatchToFirestore
};
