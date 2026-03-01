const express = require('express')
const { admin, db } = require('../firebase.js');
const axios = require('axios');
const { storeNotesData, storeSummaryData, storeUserData, storeRecommendationData } = require('../utils/batchWriter');

const { connectRedis, connectRedisSummary } = require("../config/redis.config");

let redisConnectionClient;
let redisSummaryClient;

(async () => {
    redisConnectionClient = await connectRedis();
    redisSummaryClient = await connectRedisSummary();
})();

const videoPlayerRouter = express.Router();

// In your router file (e.g., notesRouter.js)
videoPlayerRouter.post('/save-note', async (req, res) => {
    try {
        const { userId, videoId, content } = req.body;
        if (!userId || !videoId) {
            return res.status(400).json({ error: "Missing userId or videoId." });
        }

        // Use batch writer for immediate Redis storage and queued Firestore write
        const result = await storeNotesData(userId, videoId, content);
        
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        // Recompute videosWatched immediately from Redis notes and store in Redis/queue Firestore
        try {
            let videosWatched = 0;
            if (redisConnectionClient) {
                try {
                    // Get all notes from the hash structure
                    const notesHash = await redisConnectionClient.hGetAll(`notes:${userId}`);
                    if (notesHash && Object.keys(notesHash).length > 0) {
                        videosWatched = Object.keys(notesHash).length;
                    }
                } catch (notesErr) {
                    // If we get WRONGTYPE error, delete the old key and set videosWatched to 1 (current video)
                    if (notesErr.message && notesErr.message.includes('WRONGTYPE')) {
                        console.error('[Backend] Redis key type mismatch for notes count, deleting old key');
                        try {
                            await redisConnectionClient.del(`notes:${userId}`);
                        } catch (_) {}
                        videosWatched = 1; // at least the note we just saved
                    }
                }
            }
            // Fallback: if Redis not available or no notes found, use 1 for current video
            if (!videosWatched) {
                videosWatched = 1; // at least one note we just saved
            }
            await storeUserData(userId, { videosWatched });
        } catch (statErr) {
            console.error("Error updating videosWatched stat after note save:", statErr);
            // Non-fatal; continue
        }

        return res.status(200).json({ 
            success: true, 
            cached: result.cached,
            message: "Note saved; stats updated in Redis"
        });
    } catch (error) {
        console.error("Error saving video note:", error);
        res.status(500).json({ error: error.message });
    }
});




videoPlayerRouter.get('/get-note/:userId/:videoId', async (req, res) => {
    const { userId, videoId } = req.params;
    try {
        let notes = {};

        if (redisConnectionClient) {
            try {
                // Try to read specific video note from Redis hash
                const cachedField = await redisConnectionClient.hGet(`notes:${userId}`, videoId);
                if (cachedField) {
                    try {
                        const parsed = JSON.parse(cachedField);
                        return res.status(200).json({ note: parsed, cached: true });
                    } catch (_) {
                        // fallthrough to Firestore
                    }
                }
            } catch (cacheErr) {
                // If we get WRONGTYPE error, delete the old key and fall back to Firestore
                if (cacheErr.message && cacheErr.message.includes('WRONGTYPE')) {
                    console.error('[Backend] Redis key type mismatch for notes, deleting old key:', cacheErr.message);
                    try {
                        await redisConnectionClient.del(`notes:${userId}`);
                    } catch (_) {}
                } else {
                    console.error('[Backend] Redis hGet failed for notes:', cacheErr.message || cacheErr);
                }
            }
        }

        const userDocRef = db.collection('Users').doc(userId);
        const docSnap = await userDocRef.get();

        if (!docSnap.exists) {
            return res.status(404).json({ error: "User not found" });
        }
        notes = docSnap.data().notes || {};

        if (redisConnectionClient) {
            try {
                // Write each video note into the Redis hash so individual entries are preserved
                for (const [key, note] of Object.entries(notes)) {
                    try {
                        await redisConnectionClient.hSet(`notes:${userId}`, key, JSON.stringify(note));
                    } catch (_) {
                        // ignore per-field failures
                    }
                }
                await redisConnectionClient.expire(`notes:${userId}`, 86400);
            } catch (cacheErr) {
                console.error('[Backend] Failed to populate Redis hash for notes:', cacheErr.message || cacheErr);
            }
        }

        if (notes[videoId]) {
            return res.status(200).json({ note: notes[videoId], cached: false });
        } else {
            return res.status(404).json({ note: null, message: "No note for this video" });
        }
    } catch (error) {
        console.error('Error fetching note:', error);
        res.status(500).json({ error: error.message });
    }
});




// Summary: save
videoPlayerRouter.post('/summary/:videoId', async (req, res) => {
    const { videoId } = req.params;
    const { summary } = req.body || {};
    try {
        if (!videoId) {
            return res.status(400).json({ error: 'Missing videoId' });
        }
        if (typeof summary !== 'string' || summary.trim() === '') {
            return res.status(400).json({ error: 'Invalid summary' });
        }

        // Use batch writer for immediate Redis storage (12 hours) and queued Firestore write
        const result = await storeSummaryData(videoId, summary, 43200); // 12 hours
        
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        return res.status(200).json({ 
            success: true, 
            cached: result.cached,
            message: "Summary saved to Redis, queued for Firestore batch write"
        });
    } catch (error) {
        console.error(`[Backend] Error saving summary for ${videoId}:`, error.message);
        return res.status(500).json({ error: 'Failed to save summary', details: error.message });
    }
});

// Summary: fetch
videoPlayerRouter.get('/summary/:videoId', async (req, res) => {
    const { videoId } = req.params;
    try {
        // Try Redis cache first
        if (redisSummaryClient) {
            const cachedSummary = await redisSummaryClient.get(`summary:${videoId}`);
            if (cachedSummary && cachedSummary.trim() !== '') {
                return res.status(200).json({ summary: cachedSummary, cached: true });
            }
        }

        // Fallback to Firestore Summaries collection
        const docRef = db.collection('Summaries').doc(videoId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            const summary = data?.summary || '';
            if (summary && redisSummaryClient) {
                try { await redisSummaryClient.set(`summary:${videoId}`, summary, { EX: 43200 }); } catch (_) {} // 12 hours
            }
            return res.status(200).json({ summary, cached: false });
        }

        return res.status(404).json({ error: 'No summary found for this video', summary: null });
    } catch (error) {
        console.error(`[Backend] Error fetching summary for ${videoId}:`, error.message);
        return res.status(500).json({ error: 'Failed to fetch summary', details: error.message });
    }
});

// Transcript endpoint
videoPlayerRouter.get('/transcript/:videoId', async (req, res) => {
    const { videoId } = req.params;
    
    try {
        // console.log(`[Backend] Checking transcript cache for video: ${videoId}`);

        // 1) Try summary-Redis transcript key first
        if (redisSummaryClient) {
            const cachedTranscriptStr = await redisSummaryClient.get(`transcript:${videoId}`);
            if (cachedTranscriptStr) {
                try {
                    const cachedTranscript = JSON.parse(cachedTranscriptStr);
                    if (Array.isArray(cachedTranscript) && cachedTranscript.length > 0) {
                        // console.log(`[Backend] Transcript found in cache for: ${videoId} (${cachedTranscript.length} segments)`);
                        return res.status(200).json({
                            transcript: cachedTranscript,
                            cached: true
                        });
                    }
                } catch (_) { /* continue to fetch */ }
            }
        }

        // 2) Not in Redis → return 404 (extension will handle fetching)
        // console.log(`[Backend] Transcript not found in cache for: ${videoId}, going for retrieval via extension`);
            return res.status(404).json({
                error: 'No transcript available for this video',
                transcript: null
            });
        
    } catch (error) {
        console.error(`[Backend] Error checking transcript cache for ${videoId}:`, error.message);
        return res.status(500).json({ 
            error: 'Failed to check transcript cache',
            details: error.message 
        });
    }
});

// Accept and cache transcript provided by client/extension
videoPlayerRouter.post('/transcript/:videoId', async (req, res) => {
    const { videoId } = req.params;
    const { transcript } = req.body || {};

    try {
        if (!videoId) {
            return res.status(400).json({ error: 'Missing videoId' });
        }
        if (!Array.isArray(transcript) || transcript.length === 0) {
            return res.status(400).json({ error: 'Invalid transcript payload' });
        }

        // Basic shape validation for a few entries
        const isValid = transcript.every((seg) =>
            typeof seg === 'object' &&
            typeof seg.start === 'number' &&
            typeof seg.end === 'number' &&
            typeof seg.text === 'string'
        );
        if (!isValid) {
            return res.status(400).json({ error: 'Transcript items must be { start:number, end:number, text:string }' });
        }

        if (redisSummaryClient) {
            try {
                await redisSummaryClient.set(
                    `transcript:${videoId}`,
                    JSON.stringify(transcript),
                    { EX: 172800 } // 2 days
                );
            } catch (cacheErr) {
                // Non-fatal cache error; log and continue
                console.error(`[Backend] Failed to cache transcript for ${videoId}:`, cacheErr.message);
            }
        }

        // console.log(`[Backend] Successfully cached transcript for: ${videoId} (${transcript.length} segments)`);
        return res.status(200).json({ success: true, cached: Boolean(redisSummaryClient), videoId });
    } catch (error) {
        console.error(`[Backend] Error caching transcript for ${videoId}:`, error.message);
        return res.status(500).json({ error: 'Failed to cache transcript', details: error.message });
    }
});

// Accept and cache IR provided by client (from Python analyze)
videoPlayerRouter.post('/ir/:videoId', async (req, res) => {
    const { videoId } = req.params;
    const { ir } = req.body || {};

    try {
        if (!videoId) {
            return res.status(400).json({ error: 'Missing videoId' });
        }
        if (!ir || typeof ir !== 'object') {
            return res.status(400).json({ error: 'Invalid IR payload' });
        }

        if (redisSummaryClient) {
            try {
                await redisSummaryClient.set(
                    `ir:${videoId}`,
                    JSON.stringify(ir),
                    { EX: 172800 } // 2 days
                );
            } catch (cacheErr) {
                console.error(`[Backend] Failed to cache IR for ${videoId}:`, cacheErr.message);
            }
        }

        return res.status(200).json({ success: true, cached: Boolean(redisSummaryClient), videoId });
    } catch (error) {
        console.error(`[Backend] Error caching IR for ${videoId}:`, error.message);
        return res.status(500).json({ error: 'Failed to cache IR', details: error.message });
    }
});

// Retrieve cached IR if available
videoPlayerRouter.get('/ir/:videoId', async (req, res) => {
    const { videoId } = req.params;
    try {
        if (redisSummaryClient) {
            const cachedIrStr = await redisSummaryClient.get(`ir:${videoId}`);
            if (cachedIrStr) {
                try {
                    const cachedIr = JSON.parse(cachedIrStr);
                    return res.status(200).json({ ir: cachedIr, cached: true });
                } catch (_) { /* fallthrough */ }
            }
        }
        return res.status(404).json({ ir: null, error: 'No IR available for this video' });
    } catch (error) {
        console.error(`[Backend] Error fetching IR for ${videoId}:`, error.message);
        return res.status(500).json({ error: 'Failed to fetch IR', details: error.message });
    }
});

// Accept and cache recommendations provided by client
videoPlayerRouter.post('/recommendations/:videoId', async (req, res) => {
    const { videoId } = req.params;
    const { recommendations } = req.body || {};

    try {
        if (!videoId) {
            return res.status(400).json({ error: 'Missing videoId' });
        }
        if (!recommendations || typeof recommendations !== 'object') {
            return res.status(400).json({ error: 'Invalid recommendations payload' });
        }

        // Validate required fields
        const { primaryTopic, subjectCategory, similarTopics, prerequisiteTopics, nextTopics } = recommendations;
        if (!primaryTopic && !subjectCategory && !similarTopics && !prerequisiteTopics && !nextTopics) {
            return res.status(400).json({ error: 'At least one recommendation field is required' });
        }

        // Store to Redis cache only (no Firestore)
        const result = await storeRecommendationData(videoId, recommendations, 172800); // 2 days
        
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        return res.status(200).json({ 
            success: true, 
            cached: result.cached,
            message: "Recommendations saved to Redis cache"
        });
    } catch (error) {
        console.error(`[Backend] Error caching recommendations for ${videoId}:`, error.message);
        return res.status(500).json({ error: 'Failed to cache recommendations', details: error.message });
    }
});

// Retrieve cached recommendations if available
videoPlayerRouter.get('/recommendations/:videoId', async (req, res) => {
    const { videoId } = req.params;
    try {
        if (redisSummaryClient) {
            const cachedRecsStr = await redisSummaryClient.get(`recommendations:${videoId}`);
            if (cachedRecsStr) {
                try {
                    const cachedRecs = JSON.parse(cachedRecsStr);
                    return res.status(200).json({ recommendations: cachedRecs, cached: true });
                } catch (_) { /* fallthrough */ }
            }
        }
        return res.status(404).json({ recommendations: null, error: 'No recommendations available for this video' });
    } catch (error) {
        console.error(`[Backend] Error fetching recommendations for ${videoId}:`, error.message);
        return res.status(500).json({ error: 'Failed to fetch recommendations', details: error.message });
    }
});

// Accept and cache metadata provided by client/extension
videoPlayerRouter.post('/metadata/:videoId', async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body || {};

    try {
        if (!videoId) {
            return res.status(400).json({ error: 'Missing videoId' });
        }
        if (!title || !description) {
            return res.status(400).json({ error: 'Missing title or description' });
        }

        const metadata = { title, description };

        if (redisSummaryClient) {
            try {
                await redisSummaryClient.set(
                    `metadata:${videoId}`,
                    JSON.stringify(metadata),
                    { EX: 86400 } // 1 day
                );
            } catch (cacheErr) {
                // Non-fatal cache error; log and continue
                console.error(`[Backend] Failed to cache metadata for ${videoId}:`, cacheErr.message);
            }
        }

        // console.log(`[Backend] Successfully cached metadata for: ${videoId} - ${title}`);
        return res.status(200).json({ success: true, cached: Boolean(redisSummaryClient), videoId });
    } catch (error) {
        console.error(`[Backend] Error caching metadata for ${videoId}:`, error.message);
        return res.status(500).json({ error: 'Failed to cache metadata', details: error.message });
    }
});

// Video metadata endpoint
videoPlayerRouter.get('/metadata/:videoId', async (req, res) => {
    const { videoId } = req.params;
    
    try {
        // console.log(`[Backend] Checking metadata cache for video: ${videoId}`);

        // 1) Try summary-Redis metadata key first
        if (redisSummaryClient) {
            const cachedMetadataStr = await redisSummaryClient.get(`metadata:${videoId}`);
            if (cachedMetadataStr) {
                try {
                    const cachedMetadata = JSON.parse(cachedMetadataStr);
                    if (cachedMetadata.title && cachedMetadata.description) {
                        // console.log(`[Backend] Metadata found in cache for: ${videoId} - ${cachedMetadata.title}`);
                        return res.status(200).json({
                            ...cachedMetadata,
                            cached: true
                        });
                    }
                } catch (_) { /* continue to fetch */ }
            }
        }

        // 2) Not in Redis → return 404 (extension will handle fetching)
        // console.log(`[Backend] Metadata not found in cache for: ${videoId}, going for retrieval via extension`);
            return res.status(404).json({
                error: 'No metadata available for this video',
                title: null,
                description: null
            });
        
    } catch (error) {
        console.error(`[Backend] Error fetching metadata for ${videoId}:`, error.message);
        return res.status(500).json({ 
            error: 'Failed to fetch metadata', 
            details: error.message 
        });
    }
});



module.exports = { videoPlayerRouter };