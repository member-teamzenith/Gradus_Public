const express = require('express')
const { auth, db } = require('../firebase.js');
const { storeUserData } = require('../utils/batchWriter');

const { connectRedis } = require("../config/redis.config");

let redisConnectionClient;

(async () => {
    redisConnectionClient = await connectRedis();
})();

const profileRouter = express.Router();

// Statistics update function
const updateUserStatistics = async (userId) => {
    try {
        const userRef = db.collection('Users').doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            // console.log(`User ${userId} not found for statistics update`);
            return;
        }

        const userData = userSnap.data();

        // Get activity data for streak calculations
        const activityData = userData.activity || {};

        // Calculate Total Active Days
        const totalActiveDays = Object.values(activityData).filter(time => time > 0).length;

        // Calculate Max Streak - check for consecutive days
        const dates = Object.keys(activityData).sort();
        let maxStreak = 0;
        let tempStreak = 0;

        for (let i = 0; i < dates.length; i++) {
            if (activityData[dates[i]] > 0) {
                tempStreak++;
                maxStreak = Math.max(maxStreak, tempStreak);

                // Check if next date is consecutive (next day)
                if (i < dates.length - 1) {
                    const currentDate = new Date(dates[i]);
                    const nextDate = new Date(dates[i + 1]);
                    const expectedNextDate = new Date(currentDate);
                    expectedNextDate.setDate(expectedNextDate.getDate() + 1);

                    // If next date is not the consecutive day, reset temp streak
                    if (nextDate.toISOString().split('T')[0] !== expectedNextDate.toISOString().split('T')[0]) {
                        tempStreak = 0;
                    }
                }
            } else {
                tempStreak = 0;
            }
        }

        // Calculate Current Streak (from today backwards)
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        let currentStreak = 0;
        let currentDate = new Date(today);

        while (currentDate >= new Date('2020-01-01')) { // reasonable lower bound
            const dateStr = currentDate.toISOString().split('T')[0];
            if (activityData[dateStr] && activityData[dateStr] > 0) {
                currentStreak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }

        // Calculate Videos Watched (length of notes object)
        const notes = userData.notes || {};
        const videosWatched = Object.keys(notes).length;

        // Calculate Videos in last week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        let videosInLastWeek = 0;
        for (const [videoId, note] of Object.entries(notes)) {
            if (note.timestamp) {
                const noteDate = note.timestamp.toDate ? note.timestamp.toDate() : new Date(note.timestamp);
                if (noteDate >= oneWeekAgo) {
                    videosInLastWeek++;
                }
            }
        }

        // Use batch writer for immediate Redis storage and queued Firestore write
        const statsData = {
            totalActiveDays,
            maxStreak,
            currentStreak,
            videosWatched,
            videosInLastWeek,
            lastStatsUpdate: new Date()
        };

        await storeUserData(userId, statsData);

        // console.log(`Updated statistics for user ${userId}:`, {
        //     totalActiveDays,
        //     maxStreak,
        //     currentStreak,
        //     videosWatched,
        //     videosInLastWeek
        // });
    } catch (error) {
        console.error(`Error updating statistics for user ${userId}:`, error);
    }
};

// Scheduled job to update all user statistics every 12 hours
const scheduleStatisticsUpdate = () => {
    const updateAllUserStatistics = async () => {
        try {
            // console.log('Starting scheduled statistics update for all users...');

            // Get all users from Firestore
            const usersSnapshot = await db.collection('Users').get();
            const updatePromises = [];

            usersSnapshot.forEach((doc) => {
                updatePromises.push(updateUserStatistics(doc.id));
            });

            // Update all users in parallel
            await Promise.all(updatePromises);

            // console.log(`Completed statistics update for ${usersSnapshot.size} users`);
        } catch (error) {
            console.error('Error in scheduled statistics update:', error);
        }
    };

    // Run immediately on startup
    updateAllUserStatistics();

    // Schedule to run every 12 hours (43200000 milliseconds)
    setInterval(updateAllUserStatistics, 12 * 60 * 60 * 1000);

    // console.log('Statistics update job scheduled to run every 12 hours');
};

// Start the scheduled job
scheduleStatisticsUpdate();


profileRouter.get('/user-details/:uid', async (req, res) => {
    const { uid } = req.params;
    if (!uid) {
        return res.status(400).json({ error: "User ID (uid) is required in the URL." });
    }

    try {
        // Main profile (from hash)
        let userData = {}; // profile fields
        let redisHit = false;

        if (redisConnectionClient) {
            // console.log(`[Profile] Fetching user data from Redis for: ${uid}`);

            const userProfile = await redisConnectionClient.hGetAll(`user:${uid}`);
            // console.log(`[Profile] Redis user profile data:`, userProfile);

            if (userProfile && Object.keys(userProfile).length > 0) {
                userData = userProfile;
                redisHit = true;
                console.log(`[Profile] Redis data for ${uid}:`, userData);
                // Parse booleans and numbers from strings if needed!
                userData.totalActiveDays = parseInt(userData.totalActiveDays) || 0;
                userData.maxStreak = parseInt(userData.maxStreak) || 0;
                userData.currentStreak = parseInt(userData.currentStreak) || 0;
                userData.videosWatched = parseInt(userData.videosWatched) || 0;
                userData.videosInLastWeek = parseInt(userData.videosInLastWeek) || 0;
                if (typeof userData.personalDetailsAdded === 'string') {
                    userData.personalDetailsAdded = userData.personalDetailsAdded === 'true';
                }
            }

            // Also try to get statistics from separate Redis keys (newer approach)
            const totalActiveDays = await redisConnectionClient.get(`totalActiveDays:${uid}`);
            const maxStreak = await redisConnectionClient.get(`maxStreak:${uid}`);
            const currentStreak = await redisConnectionClient.get(`currentStreak:${uid}`);
            const videosWatched = await redisConnectionClient.get(`videosWatched:${uid}`);
            const videosInLastWeek = await redisConnectionClient.get(`videosInLastWeek:${uid}`);
            const maxTokensKey = await redisConnectionClient.get(`MaxTokens:${uid}`);
            try {
                // console.log(`[Profile] Redis MaxTokens for ${uid}:`, maxTokensKey); 
            } catch (_) { }

            // console.log(`[Profile] Redis stats data:`, { totalActiveDays, maxStreak, currentStreak, videosWatched, videosInLastWeek });

            if (totalActiveDays !== null) userData.totalActiveDays = parseInt(totalActiveDays) || 0;
            if (maxStreak !== null) userData.maxStreak = parseInt(maxStreak) || 0;
            if (currentStreak !== null) userData.currentStreak = parseInt(currentStreak) || 0;
            if (videosWatched !== null) userData.videosWatched = parseInt(videosWatched) || 0;
            if (videosInLastWeek !== null) userData.videosInLastWeek = parseInt(videosInLastWeek) || 0;
            // Always source MaxTokens from Redis key first; if missing, fallback to Firestore and then cache to Redis
            userData.MaxTokens = undefined;
            if (maxTokensKey !== null && maxTokensKey !== undefined) {
                const n = parseInt(maxTokensKey);
                if (!Number.isNaN(n) && n > 0) userData.MaxTokens = n;
            }
            if ((userData.MaxTokens === undefined || userData.MaxTokens <= 0)) {
                try {
                    const userRef = db.collection('Users').doc(uid);
                    const userSnap = await userRef.get();
                    if (userSnap.exists) {
                        const data = userSnap.data() || {};
                        const fromFs = (typeof data.MaxTokens === 'number' ? data.MaxTokens : parseInt(data.MaxTokens))
                            || (typeof data.maxTokens === 'number' ? data.maxTokens : parseInt(data.maxTokens));
                        if (!Number.isNaN(fromFs) && fromFs > 0) {
                            userData.MaxTokens = fromFs;
                            try { await redisConnectionClient.set(`MaxTokens:${uid}`, String(fromFs)); } catch (_) { }
                            try {
                                //  console.log(`[Profile] Fallback Firestore MaxTokens for ${uid}:`, fromFs); 
                            } catch (_) { }
                        }
                    }
                } catch (_) { }
            }
        }

        // Interests, exams, subjects
        let interests = [];
        let subjects = [];
        let course = [];
        if (redisConnectionClient) {
            const interestsCache = await redisConnectionClient.get(`interests:${uid}`);
            const subjectsCache = await redisConnectionClient.get(`subjects:${uid}`);
            const courseCache = await redisConnectionClient.get(`course:${uid}`);
            if (interestsCache) interests = JSON.parse(interestsCache);
            if (subjectsCache) subjects = JSON.parse(subjectsCache);
            if (courseCache) course = JSON.parse(courseCache);
        }

        // Fallback to Firestore if Redis miss OR if user exists but is incomplete (missing essential fields)
        if (!redisHit || (!userData.name && !userData.email)) {
            // console.log(`[Profile] Redis miss or incomplete data for ${uid}, falling back to Firestore`);
            const userRef = db.collection('Users').doc(uid);
            const userSnap = await userRef.get();
            if (!userSnap.exists) {
                // If user doesn't exist in Firestore either, check if they exist in Redis with partial data
                if (redisHit && userData.email) {
                    // User exists in Redis but not in Firestore yet (new user)
                    return res.status(200).json({
                        data: {
                            ...userData,
                            interests: interests || [],
                            subjects: subjects || [],
                            course: course || []
                        }
                    });
                }
                return res.status(404).json({ error: "User not found." });
            }
            userData = userSnap.data();
            // Do not use Firestore MaxTokens; only Redis is canonical
            interests = userData.interests || [];
            subjects = userData.subjects || [];
            course = userData.course || [];

            // Calculate video statistics if not already present
            const notes = userData.notes || {};
            const videosWatched = Object.keys(notes).length;

            // Calculate Videos in last week
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            let videosInLastWeek = 0;
            for (const [videoId, note] of Object.entries(notes)) {
                if (note.timestamp) {
                    const noteDate = note.timestamp.toDate ? note.timestamp.toDate() : new Date(note.timestamp);
                    if (noteDate >= oneWeekAgo) {
                        videosInLastWeek++;
                    }
                }
            }

            // Update Redis for next time
            if (redisConnectionClient) {
                const TTL_20_DAYS = 1728000; // 20 days
                const TTL_7_DAYS = 604800; // 7 days

                await redisConnectionClient.hSet(`user:${uid}`, {
                    name: userData.name || '',
                    age: String(userData.age || ''),
                    gender: userData.gender || '',
                    email: userData.email || '',
                    photo: userData.photo || '',
                    hasCourse: String(Array.isArray(userData.course) && userData.course.length > 0),
                    hasInterests: String(Array.isArray(userData.interests) && userData.interests.length > 0),
                    totalActiveDays: String(userData.totalActiveDays || 0),
                    maxStreak: String(userData.maxStreak || 0),
                    currentStreak: String(userData.currentStreak || 0),
                    personalDetailsAdded: String(!!userData.personalDetailsAdded)
                });
                await redisConnectionClient.set(`interests:${uid}`, JSON.stringify(interests));
                await redisConnectionClient.set(`subjects:${uid}`, JSON.stringify(subjects));
                await redisConnectionClient.set(`course:${uid}`, JSON.stringify(course));
                // Do not write MaxTokens from Firestore; Redis key is managed elsewhere

                // Cache video statistics with proper TTL
                await redisConnectionClient.set(
                    `videosWatched:${uid}`,
                    String(videosWatched),
                    { EX: TTL_20_DAYS }
                );
                await redisConnectionClient.set(
                    `videosInLastWeek:${uid}`,
                    String(videosInLastWeek),
                    { EX: TTL_7_DAYS }
                );
            }

            // Add the calculated values to userData for response
            userData.videosWatched = videosWatched;
            userData.videosInLastWeek = videosInLastWeek;
        }

        // Ensure MaxTokens is present from Redis key at the very end
        try {
            let finalMax = userData && typeof userData.MaxTokens === 'number' ? userData.MaxTokens : 0;
            if (redisConnectionClient) {
                const v = await redisConnectionClient.get(`MaxTokens:${uid}`);
                const n = parseInt(v);
                if (!Number.isNaN(n) && n > 0) finalMax = n;
            }
            if (!userData) userData = {};
            if (finalMax > 0) userData.MaxTokens = finalMax;
            // console.log(`[Profile] Final MaxTokens for ${uid}:`, userData && userData.MaxTokens);
        } catch (_) { }
        return res.status(200).json({
            data: {
                ...userData,
                interests,
                subjects,
                course
            }
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});


// In your router file (e.g., profileRouter.js)
profileRouter.post('/update-user-selections', async (req, res) => {
    try {
        const { userId, tab, subjects, interests } = req.body;

        if (!userId || !tab) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        const userRef = db.collection("Users").doc(userId);
        let updateObj = {};

        if (tab === "Academia") {
            if (Array.isArray(subjects)) updateObj.subjects = subjects;
        } else if (tab === "Beyond") {
            if (Array.isArray(interests)) updateObj.interests = interests;
        } else {
            return res.status(400).json({ error: "Invalid tab value." });
        }

        // Use batch writer for immediate Redis storage and queued Firestore write
        const userData = { ...updateObj };
        if (tab === "Academia") {
            if (Array.isArray(subjects)) userData.subjects = subjects;
        } else if (tab === "Beyond" && Array.isArray(interests)) {
            userData.interests = interests;
        }

        await storeUserData(userId, userData);

        res.status(200).json({ success: true, updated: updateObj });
    } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({ error: error.message });
    }
});


profileRouter.get('/user-activity/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        let activityData = null;
        let redisHit = false;

        if (redisConnectionClient) {
            const cached = await redisConnectionClient.get(`activity:${userId}`);
            if (cached) {
                activityData = JSON.parse(cached);
                redisHit = true;
                // console.log(`[Activity] Redis activity data for ${userId}:`, activityData);
                return res.status(200).json({ activity: activityData, cached: true });
            }
        }

        // Fallback to Firestore if Redis miss
        const userRef = db.collection('Users').doc(userId);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            // If user doesn't exist in Firestore either, check if they exist in Redis with partial data
            if (redisConnectionClient) {
                const userProfile = await redisConnectionClient.hGetAll(`user:${userId}`);
                if (userProfile && Object.keys(userProfile).length > 0) {
                    // User exists in Redis but not in Firestore yet (new user)
                    // Return empty activity data for new users
                    return res.status(200).json({ activity: {}, cached: false });
                }
            }
            return res.status(404).json({ error: 'User not found.' });
        }

        activityData = userSnap.data().activity || {};

        if (redisConnectionClient) {
            await redisConnectionClient.set(
                `activity:${userId}`,
                JSON.stringify(activityData),
                {
                    EX: 86400
                }
            );
        }

        res.status(200).json({ activity: activityData, cached: false });
    } catch (error) {
        console.error('Error fetching activity data:', error);
        res.status(500).json({ error: error.message });
    }
});


// Manual trigger for statistics update
profileRouter.post('/update-user-stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required." });
        }

        await updateUserStatistics(userId);

        res.status(200).json({
            success: true,
            message: `Statistics updated for user ${userId}`
        });
    } catch (error) {
        console.error('Error manually updating user statistics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Manual trigger for all users statistics update
profileRouter.post('/update-all-stats', async (req, res) => {
    try {
        // console.log('Manual trigger: Starting statistics update for all users...');

        // Get all users from Firestore
        const usersSnapshot = await db.collection('Users').get();
        const updatePromises = [];

        usersSnapshot.forEach((doc) => {
            updatePromises.push(updateUserStatistics(doc.id));
        });

        // Update all users in parallel
        await Promise.all(updatePromises);

        // console.log(`Manual trigger: Completed statistics update for ${usersSnapshot.size} users`);

        res.status(200).json({
            success: true,
            message: `Statistics updated for ${usersSnapshot.size} users`
        });
    } catch (error) {
        console.error('Error manually updating all user statistics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint to check Redis connection
profileRouter.get('/test-redis/:uid', async (req, res) => {
    const { uid } = req.params;
    try {
        if (!redisConnectionClient) {
            return res.status(500).json({ error: "Redis client not connected" });
        }

        // Test basic Redis operations
        await redisConnectionClient.set(`test:${uid}`, "test-value", { EX: 60 });
        const testValue = await redisConnectionClient.get(`test:${uid}`);

        // Check if user data exists
        const userProfile = await redisConnectionClient.hGetAll(`user:${uid}`);
        const totalActiveDays = await redisConnectionClient.get(`totalActiveDays:${uid}`);

        res.status(200).json({
            redisConnected: true,
            testValue,
            userProfile,
            totalActiveDays,
            message: "Redis test successful"
        });
    } catch (error) {
        console.error('Redis test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to check both FirstFlame and BugHunter badges
profileRouter.get('/check-badges/:uid', async (req, res) => {
    const { uid } = req.params;
    try {
        let firstFlame = false;
        let bugHunter = false;
        let firstFlameSource = 'none';
        let bugHunterSource = 'none';

        // Check Redis first - just check if keys exist
        if (redisConnectionClient) {
            // Check FirstFlame
            const firstFlameKey = `FirstFlame:${uid}`;
            const firstFlameValue = await redisConnectionClient.get(firstFlameKey);

            // console.log(`[Badges] Checking FirstFlame Redis key: ${firstFlameKey}`);
            // console.log(`[Badges] FirstFlame key exists: ${firstFlameValue !== null}`);

            if (firstFlameValue !== null) {
                firstFlame = true;
                firstFlameSource = 'redis';
                // console.log(`[Badges] FirstFlame badge will be shown - key exists in Redis`);
            }

            // Check BugHunter
            const bugHunterKey = `BugHunter:${uid}`;
            const bugHunterValue = await redisConnectionClient.get(bugHunterKey);

            // console.log(`[Badges] Checking BugHunter Redis key: ${bugHunterKey}`);
            // console.log(`[Badges] BugHunter key exists: ${bugHunterValue !== null}`);

            if (bugHunterValue !== null) {
                bugHunter = true;
                bugHunterSource = 'redis';
                // console.log(`[Badges] BugHunter badge will be shown - key exists in Redis`);
            }
        }

        // If not found in Redis, check Firestore database
        const userRef = db.collection('Users').doc(uid);
        const userSnap = await userRef.get();

        if (userSnap.exists) {
            const userData = userSnap.data();

            // Check FirstFlame field
            if (!firstFlame && userData.hasOwnProperty('isFirstFlame')) {
                firstFlame = true;
                firstFlameSource = 'firestore';
                console.log(`[Badges] FirstFlame badge will be shown - field exists in Firestore`);
            }

            // Check BugHunter field
            if (!bugHunter && userData.hasOwnProperty('isBugHunter')) {
                bugHunter = true;
                bugHunterSource = 'firestore';
                // console.log(`[Badges] BugHunter badge will be shown - field exists in Firestore`);
            }
        }

        // console.log(`[Badges] Final result for ${uid}: firstFlame=${firstFlame} (${firstFlameSource}), bugHunter=${bugHunter} (${bugHunterSource})`);

        res.status(200).json({
            uid,
            firstFlame,
            firstFlameSource,
            bugHunter,
            bugHunterSource,
            message: "Badges check successful"
        });
    } catch (error) {
        console.error('Badges check error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update user time for today (simplified endpoint for TimeTracker)
profileRouter.post('/update-user-time', async (req, res) => {
    try {
        const { userId, timeSpent } = req.body;

        if (!userId || timeSpent === undefined) {
            return res.status(400).json({ error: "User ID and time spent are required." });
        }

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        // Get current activity data from Redis or Firestore
        let activityData = {};

        // Try Redis first
        if (redisConnectionClient) {
            const cached = await redisConnectionClient.get(`activity:${userId}`);
            if (cached) {
                activityData = JSON.parse(cached);
            }
        }

        // If not in Redis, get from Firestore
        if (Object.keys(activityData).length === 0) {
            const userRef = db.collection('Users').doc(userId);
            const userSnap = await userRef.get();
            if (userSnap.exists) {
                activityData = userSnap.data().activity || {};
            }
        }

        // Update today's activity
        activityData[today] = timeSpent;

        // Calculate statistics
        const totalActiveDays = Object.values(activityData).filter(time => time > 0).length;

        // Calculate Max Streak
        const dates = Object.keys(activityData).sort();
        let maxStreak = 0;
        let tempStreak = 0;

        for (let i = 0; i < dates.length; i++) {
            if (activityData[dates[i]] > 0) {
                tempStreak++;
                maxStreak = Math.max(maxStreak, tempStreak);

                if (i < dates.length - 1) {
                    const currentDate = new Date(dates[i]);
                    const nextDate = new Date(dates[i + 1]);
                    const expectedNextDate = new Date(currentDate);
                    expectedNextDate.setDate(expectedNextDate.getDate() + 1);

                    if (nextDate.toISOString().split('T')[0] !== expectedNextDate.toISOString().split('T')[0]) {
                        tempStreak = 0;
                    }
                }
            } else {
                tempStreak = 0;
            }
        }

        // Calculate Current Streak
        let currentStreak = 0;
        let currentDate = new Date(today);

        while (currentDate >= new Date('2020-01-01')) {
            const dateStr = currentDate.toISOString().split('T')[0];
            if (activityData[dateStr] && activityData[dateStr] > 0) {
                currentStreak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }

        // Prepare data for batch writer
        const userData = {
            activity: activityData,
            totalActiveDays,
            maxStreak,
            currentStreak
        };

        // Use batch writer for immediate Redis storage and queued Firestore write
        await storeUserData(userId, userData);

        res.status(200).json({
            success: true,
            message: "User time updated successfully"
        });
    } catch (error) {
        console.error('Error updating user time:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user notes from Redis or Firestore
profileRouter.get('/user-notes/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        let notesData = {};
        let redisHit = false;

        if (redisConnectionClient) {
            try {
                // Try to read all notes from Redis hash
                const notesHash = await redisConnectionClient.hGetAll(`notes:${userId}`);
                if (notesHash && Object.keys(notesHash).length > 0) {
                    // Parse each note from JSON string
                    notesData = {};
                    for (const [videoId, noteStr] of Object.entries(notesHash)) {
                        try {
                            notesData[videoId] = JSON.parse(noteStr);
                        } catch (_) {
                            // Skip invalid entries
                        }
                    }
                    redisHit = true;
                }
            } catch (cacheErr) {
                // If we get WRONGTYPE error, delete the old key and fall back to Firestore
                if (cacheErr.message && cacheErr.message.includes('WRONGTYPE')) {
                    console.error('[Backend] Redis key type mismatch for notes, deleting old key:', cacheErr.message);
                    try {
                        await redisConnectionClient.del(`notes:${userId}`);
                    } catch (_) { }
                } else {
                    console.error('[Backend] Redis hGetAll failed for notes:', cacheErr.message || cacheErr);
                }
            }
        }

        // Fallback to Firestore if Redis miss
        if (!redisHit || Object.keys(notesData).length === 0) {
            const userRef = db.collection('Users').doc(userId);
            const userSnap = await userRef.get();

            if (!userSnap.exists) {
                return res.status(404).json({ error: 'User not found.' });
            }

            notesData = userSnap.data().notes || {};

            // Cache to Redis for future requests (exclude summary field)
            if (redisConnectionClient && Object.keys(notesData).length > 0) {
                try {
                    // Write each video note into the Redis hash
                    for (const [videoId, note] of Object.entries(notesData)) {
                        const noteWithoutSummary = {
                            content: note.content || "",
                            timestamp: note.timestamp,
                            videoId: note.videoId || videoId
                        };
                        try {
                            await redisConnectionClient.hSet(`notes:${userId}`, videoId, JSON.stringify(noteWithoutSummary));
                        } catch (_) {
                            // ignore per-field failures
                        }
                    }
                    await redisConnectionClient.expire(`notes:${userId}`, 86400); // 24 hours
                } catch (cacheErr) {
                    console.error('[Backend] Failed to populate Redis hash for notes:', cacheErr.message || cacheErr);
                }
            }
        }

        res.status(200).json({ notes: notesData, cached: redisHit });
    } catch (error) {
        console.error('Error fetching user notes:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update user activity data and statistics
profileRouter.post('/update-activity', async (req, res) => {
    try {
        const { userId, activityData, stats } = req.body;

        if (!userId || !activityData) {
            return res.status(400).json({ error: "User ID and activity data are required." });
        }

        // Calculate statistics if not provided
        let calculatedStats = stats;
        if (!stats) {
            // Calculate Total Active Days
            const totalActiveDays = Object.values(activityData).filter(time => time > 0).length;

            // Calculate Max Streak - check for consecutive days
            const dates = Object.keys(activityData).sort();
            let maxStreak = 0;
            let tempStreak = 0;

            for (let i = 0; i < dates.length; i++) {
                if (activityData[dates[i]] > 0) {
                    tempStreak++;
                    maxStreak = Math.max(maxStreak, tempStreak);

                    // Check if next date is consecutive (next day)
                    if (i < dates.length - 1) {
                        const currentDate = new Date(dates[i]);
                        const nextDate = new Date(dates[i + 1]);
                        const expectedNextDate = new Date(currentDate);
                        expectedNextDate.setDate(expectedNextDate.getDate() + 1);

                        // If next date is not the consecutive day, reset temp streak
                        if (nextDate.toISOString().split('T')[0] !== expectedNextDate.toISOString().split('T')[0]) {
                            tempStreak = 0;
                        }
                    }
                } else {
                    tempStreak = 0;
                }
            }

            // Calculate Current Streak (from today backwards)
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            let currentStreak = 0;
            let currentDate = new Date(today);

            while (currentDate >= new Date('2020-01-01')) { // reasonable lower bound
                const dateStr = currentDate.toISOString().split('T')[0];
                if (activityData[dateStr] && activityData[dateStr] > 0) {
                    currentStreak++;
                    currentDate.setDate(currentDate.getDate() - 1);
                } else {
                    break;
                }
            }

            calculatedStats = {
                totalActiveDays,
                maxStreak,
                currentStreak
            };
        }

        // Prepare data for batch writer
        const userData = {
            activity: activityData,
            ...calculatedStats // totalActiveDays, maxStreak, currentStreak
        };

        // Use batch writer for immediate Redis storage and queued Firestore write
        await storeUserData(userId, userData);

        res.status(200).json({
            success: true,
            message: "Activity data updated successfully"
        });
    } catch (error) {
        console.error('Error updating activity data:', error);
        res.status(500).json({ error: error.message });
    }
});







module.exports = { profileRouter };




