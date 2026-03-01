const express = require('express')
const { auth, db } = require('../firebase.js');
const { storeUserData, storeNotebookData } = require('../utils/batchWriter.js');

const { connectRedis } = require("../config/redis.config.js");

let redisConnectionClient;

(async () => {
    redisConnectionClient = await connectRedis();
})();

const noteBookRouter = express.Router();

// GET notebooks hash for a user
noteBookRouter.get('/get-notebooks/:uid', async (req, res) => {
    try {
        const { uid } = req.params;

        if (!uid) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        let notebooks = {};
        let fromCache = false;

        // 1. Try Redis first
        if (redisConnectionClient) {
            try {
                notebooks = await redisConnectionClient.hGetAll(`notebooks:${uid}`);
                if (Object.keys(notebooks).length > 0) {
                    fromCache = true;
                }
            } catch (redisError) {
                console.error('Redis error fetching notebooks:', redisError.message);
                // Continue to Firestore
            }
        }

        // 2. If not in Redis, try Firestore
        if (!fromCache) {
            try {
                const userDoc = await db.collection('Users').doc(uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData.notebooks) {
                        notebooks = userData.notebooks;

                        // Optional: Populate Redis for next time
                        if (redisConnectionClient) {
                            for (const [name, content] of Object.entries(notebooks)) {
                                await redisConnectionClient.hSet(`notebooks:${uid}`, name, content);
                            }
                        }
                    }
                }
            } catch (firestoreError) {
                console.error('Firestore error fetching notebooks:', firestoreError.message);
            }
        }

        res.status(200).json({ notebooks });

    } catch (error) {
        console.error('Error fetching notebooks:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET notebooks hash for a user (POST version)
noteBookRouter.post('/get-notebooks', async (req, res) => {
    try {
        const { uid } = req.body;

        if (!uid) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        let notebooks = {};
        let fromCache = false;

        // 1. Try Redis first
        if (redisConnectionClient) {
            try {
                notebooks = await redisConnectionClient.hGetAll(`notebooks:${uid}`);
                if (Object.keys(notebooks).length > 0) {
                    fromCache = true;
                }
            } catch (redisError) {
                console.error('Redis error fetching notebooks:', redisError.message);
                // Continue to Firestore
            }
        }

        // 2. If not in Redis, try Firestore
        if (!fromCache) {
            try {
                const userDoc = await db.collection('Users').doc(uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData.notebooks) {
                        notebooks = userData.notebooks;

                        // Optional: Populate Redis for next time
                        if (redisConnectionClient) {
                            for (const [name, content] of Object.entries(notebooks)) {
                                await redisConnectionClient.hSet(`notebooks:${uid}`, name, content);
                            }
                        }
                    }
                }
            } catch (firestoreError) {
                console.error('Firestore error fetching notebooks:', firestoreError.message);
            }
        }

        res.status(200).json({ notebooks });

    } catch (error) {
        console.error('Error fetching notebooks:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Create a new notebook (fails if exists)
noteBookRouter.post('/create-notebook', async (req, res) => {
    try {
        const { uid, notebookName, content } = req.body;

        if (!uid || !notebookName || !content) {
            return res.status(400).json({ error: 'uid, notebookName, and content are required' });
        }

        if (redisConnectionClient) {
            try {
                // Check if notebook with same name already exists
                const existingNotebook = await redisConnectionClient.hGet(`notebooks:${uid}`, notebookName);

                if (existingNotebook) {
                    return res.status(409).json({
                        error: 'A notebook with this name already exists',
                        notebookName
                    });
                }

                await redisConnectionClient.hSet(`notebooks:${uid}`, notebookName, content);

                // Sync to Firestore via batchWriter
                storeNotebookData(uid, notebookName, content);

                res.status(200).json({
                    message: 'Notebook saved successfully',
                    notebookName,
                    uid
                });
            } catch (redisError) {
                console.error('Redis error saving notebook:', redisError.message);
                return res.status(500).json({ error: 'Failed to save notebook to Redis' });
            }
        } else {
            return res.status(503).json({ error: 'Redis connection not available' });
        }

    } catch (error) {
        console.error('Error saving notebook:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT - Overwrite a notebook (for edits/saves)
noteBookRouter.put('/overwrite-notebook', async (req, res) => {
    try {
        const { uid, notebookName, content } = req.body;

        if (!uid || !notebookName || !content) {
            return res.status(400).json({ error: 'uid, notebookName, and content are required' });
        }

        if (redisConnectionClient) {
            try {
                // Directly set (overwrite) the notebook content
                await redisConnectionClient.hSet(`notebooks:${uid}`, notebookName, content);

                // Sync to Firestore via batchWriter
                storeNotebookData(uid, notebookName, content);

                res.status(200).json({
                    message: 'Notebook overwritten successfully',
                    notebookName,
                    uid
                });
            } catch (redisError) {
                console.error('Redis error overwriting notebook:', redisError.message);
                return res.status(500).json({ error: 'Failed to overwrite notebook in Redis' });
            }
        } else {
            return res.status(503).json({ error: 'Redis connection not available' });
        }

    } catch (error) {
        console.error('Error overwriting notebook:', error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH - Update notebook content (append new content to existing)
noteBookRouter.patch('/update-notebook', async (req, res) => {
    try {
        const { uid, notebookName, content } = req.body;

        if (!uid || !notebookName || !content) {
            return res.status(400).json({ error: 'uid, notebookName, and content are required' });
        }

        if (redisConnectionClient) {
            try {
                // Get existing notebook content
                const existingContent = await redisConnectionClient.hGet(`notebooks:${uid}`, notebookName);

                if (!existingContent) {
                    return res.status(404).json({
                        error: 'Notebook not found',
                        notebookName
                    });
                }

                // Append new content to existing content
                const updatedContent = existingContent + " " + content;

                // Update the notebook with combined content
                await redisConnectionClient.hSet(`notebooks:${uid}`, notebookName, updatedContent);

                // Sync to Firestore via batchWriter
                storeNotebookData(uid, notebookName, updatedContent);

                res.status(200).json({
                    message: 'Notebook updated successfully',
                    notebookName,
                    uid,
                    updatedContent
                });
            } catch (redisError) {
                console.error('Redis error updating notebook:', redisError.message);
                return res.status(500).json({ error: 'Failed to update notebook in Redis' });
            }
        } else {
            return res.status(503).json({ error: 'Redis connection not available' });
        }

    } catch (error) {
        console.error('Error updating notebook:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Delete a notebook by name
noteBookRouter.delete('/delete-notebook', async (req, res) => {
    try {
        const { uid, notebookName } = req.body;

        if (!uid || !notebookName) {
            return res.status(400).json({ error: 'uid and notebookName are required' });
        }

        if (redisConnectionClient) {
            try {
                // Check if notebook exists
                const existingNotebook = await redisConnectionClient.hGet(`notebooks:${uid}`, notebookName);

                if (!existingNotebook) {
                    return res.status(404).json({
                        error: 'Notebook not found',
                        notebookName
                    });
                }

                // Delete the notebook field from hash
                await redisConnectionClient.hDel(`notebooks:${uid}`, notebookName);

                // Sync deletion to Firestore via batchWriter
                storeNotebookData(uid, notebookName, null, true);

                res.status(200).json({
                    message: 'Notebook deleted successfully',
                    notebookName,
                    uid
                });
            } catch (redisError) {
                console.error('Redis error deleting notebook:', redisError.message);
                return res.status(500).json({ error: 'Failed to delete notebook from Redis' });
            }
        } else {
            return res.status(503).json({ error: 'Redis connection not available' });
        }

    } catch (error) {
        console.error('Error deleting notebook:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = { noteBookRouter };