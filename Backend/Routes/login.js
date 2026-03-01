const express = require('express');
const fs = require('fs');
const { auth, db } = require('../firebase.js');
const { storeUserData } = require('../utils/batchWriter');
const { connectRedis } = require('../config/redis.config'); 
const loginRouter = express.Router();

let redisConnectionClient;
(async () => {
    redisConnectionClient = await connectRedis();
})();

loginRouter.post('/saveUserDetails', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: "Missing userId in request body." });
    }

    try {
        // Fetch full user data from Firestore
        const userRef = db.collection('Users').doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return res.status(404).json({ error: "User not found in Firestore." });
        }

        const {
            name = "",
            age = "",
            photo="",
            gender = "",
            email = "",
            course = "",
            hasCourse = false,
            hasInterests = false,
            savedPlaylists = [],
            activity = [],
            subjects = [],
            exams = [],
            interests = [],
            totalActiveDays = 0,
            maxStreak = 0,
            currentStreak = 0,
            videosWatched = 0,
            videosInLastWeek = 0
        } = userSnap.data();

        // Use batch writer for immediate Redis storage and queued Firestore write
        const userData = {
            name,
            age,
            photo,
            gender,
            email,
            course,
            hasCourse,
            hasInterests,
            interests,
            exams,
            subjects,
            activity,
            savedPlaylists,
            totalActiveDays,
            maxStreak,
            currentStreak,
            videosWatched,
            videosInLastWeek
        };
        
        await storeUserData(userId, userData);



        res.status(200).json({ message: `User data for ${userId} saved to Redis in structured format.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



module.exports = { loginRouter };
