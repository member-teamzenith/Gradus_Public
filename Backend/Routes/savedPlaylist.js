const express = require('express');
const { db } = require('../firebase.js');
const { connectRedis } = require('../config/redis.config');
const savedPlaylistRouter = express.Router();

let redisConnectionClient;
(async () => {
    redisConnectionClient = await connectRedis();
})();


savedPlaylistRouter.get('/playlists/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {

        const cache = await redisConnectionClient.get(`savedPlaylists:${userId}`);
        if (cache) {

            return res.status(200).json({ playlists: JSON.parse(cache), cached: true });
        }


        const userRef = db.collection('Users').doc(userId);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            return res.status(404).json({ error: "User not found in Firestore." });
        }
        const { savedPlaylists = {} } = userSnap.data();


        let playlistsToCache = savedPlaylists;
        if (!playlistsToCache || typeof playlistsToCache !== 'object' || Array.isArray(playlistsToCache)) {
            playlistsToCache = {};
        }
        await redisConnectionClient.set(
            `savedPlaylists:${userId}`,
            JSON.stringify(playlistsToCache)
        );



        res.status(200).json({ playlists: savedPlaylists, cached: false });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// savedPlaylistRouter.get('/playlists/:userId', async (req, res) => {
//     const userId = req.params.userId;
//     try {
//         const userRef = db.collection('Users').doc(userId);
//         const userSnap = await userRef.get();

//         if (!userSnap.exists) {
//             return res.status(404).json({ error: "User not found in Firestore." });
//         }

//         const { savedPlaylists = {} } = userSnap.data();

//         let playlistsToReturn = savedPlaylists;
//         if (!playlistsToReturn || typeof playlistsToReturn !== 'object' || Array.isArray(playlistsToReturn)) {
//             playlistsToReturn = {};
//         }

//         res.status(200).json({ playlists: playlistsToReturn, cached: false });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });



savedPlaylistRouter.get('/playlist/:userId/:playlistId', async (req, res) => {
    const { userId, playlistId } = req.params;
    try {
        let playlists = null;

        // Try Redis cache first for all playlists of the user
        if (redisConnectionClient) {
            const cache = await redisConnectionClient.get(`savedPlaylists:${userId}`);
            if (cache) {
                playlists = JSON.parse(cache);
            }
        }

        // Fallback to Firestore if Redis miss
        if (!playlists) {
            const userRef = db.collection('Users').doc(userId);
            const userSnap = await userRef.get();

            if (!userSnap.exists) {
                return res.status(404).json({ error: "User not found in Firestore.", playlist: null });
            }

            playlists = userSnap.data().savedPlaylists || {};

            // Cache the playlists object for next time
            if (redisConnectionClient) {
                await redisConnectionClient.set(
                    `savedPlaylists:${userId}`,
                    JSON.stringify(playlists)
                );
            }
        }

        // Fetch the particular playlist from the playlists object
        const playlistData = playlists[playlistId] || null;

        if (!playlistData) {
            return res.status(404).json({ error: "Playlist not found.", playlist: null });
        }

        res.status(200).json({ playlist: playlistData });
    } catch (error) {
        res.status(500).json({ error: error.message, playlist: null });
    }
});


// savedPlaylistRouter.get('/playlist/:userId/:playlistId', async (req, res) => {
//     const { userId, playlistId } = req.params;
//     try {
//         // Always fetch from Firestore
//         const userRef = db.collection('Users').doc(userId);
//         const userSnap = await userRef.get();

//         if (!userSnap.exists) {
//             return res.status(404).json({ error: "User not found in Firestore.", playlist: null });
//         }

//         const playlists = userSnap.data().savedPlaylists || {};

//         // Fetch the particular playlist from the playlists object
//         const playlistData = playlists[playlistId] || null;

//         if (!playlistData) {
//             return res.status(404).json({ error: "Playlist not found.", playlist: null });
//         }

//         res.status(200).json({ playlist: playlistData });
//     } catch (error) {
//         res.status(500).json({ error: error.message, playlist: null });
//     }
// });




savedPlaylistRouter.delete('/delete-playlists/:userId/:playlistId', async (req, res) => {
    const { userId, playlistId } = req.params;
    try {
        // Remove from Firestore
        const userRef = db.collection('Users').doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return res.status(404).json({ error: "User not found in Firestore." });
        }

        // Get current playlists and remove the target
        const savedPlaylists = userSnap.data().savedPlaylists || {};
        if (!savedPlaylists[playlistId]) {
            return res.status(404).json({ error: "Playlist not found." });
        }
        delete savedPlaylists[playlistId];

        // Update Firestore
        await userRef.update({ savedPlaylists });

        // Update Redis cache
        if (redisConnectionClient) {
            await redisConnectionClient.set(
                `savedPlaylists:${userId}`,
                JSON.stringify(savedPlaylists)
            );
            // Optionally, remove the single playlist cache if stored separately
            await redisConnectionClient.del(`savedPlaylists:${playlistId}`);
        }

        res.status(200).json({ success: true, message: "Playlist deleted and cache updated." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});




module.exports = { savedPlaylistRouter };
