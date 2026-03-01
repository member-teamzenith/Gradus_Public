const express = require('express');
const router = express.Router();
const { db } = require('../firebase.js');
const { storeUserData } = require('../utils/batchWriter');
const { connectRedis } = require("../config/redis.config");

let redisConnectionClient;

(async () => {
    redisConnectionClient = await connectRedis();
})();

const onBoardingRouter = express.Router();


onBoardingRouter.post('/register', async (req, res) => {
  const { uid, email } = req.body;

  if (!uid || !email) {
    return res.status(400).json({ error: "UID and Email required" });
  }

  try {
    const userData = {
      email,
      photo: "",
      personalDetailsAdded: false,
      createdAt: new Date(),
      MaxTokens: 50000
    };

    // Use batch writer for immediate Redis storage and queued Firestore write
    // Note: storeUserData already creates the dedicated MaxTokens:uid Redis key
    await storeUserData(uid, userData);

    res.status(201).json({ message: "User info saved to Redis, queued for Firestore batch write" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


onBoardingRouter.post('/personal-details', async (req, res) => {
  const { uid, name, gender, age, email, photo } = req.body;

  // Check required fields (uid, name, email, photo must be present and non-empty)
  if (!uid || !name || !email || !photo) {
    return res.status(400).json({ error: "Required fields (uid, name, email, photo) must be provided." });
  }

  // Check that gender and age are provided (can be empty strings for incomplete profiles)
  if (gender === undefined || age === undefined) {
    return res.status(400).json({ error: "Gender and age fields must be provided (can be empty strings)." });
  }

  try {
    const userData = {
      name,
      gender,
      age,
      email,
      photo,
      personalDetailsAdded: true
    };

    // Use batch writer for immediate Redis storage and queued Firestore write
    await storeUserData(uid, userData);

    res.status(200).json({ message: "Personal details saved to Redis, queued for Firestore batch write" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


onBoardingRouter.post('/course-interest', async (req, res) => {
  const { uid, hasCourse, hasInterests } = req.body;

  if (!uid || typeof hasCourse === 'undefined' || typeof hasInterests === 'undefined') {
    return res.status(400).json({ error: "Fields uid, hasCourse, hasInterests are required." });
  }

  try {
    const userData = {
      hasCourse,
      hasInterests
    };

    // Use batch writer for immediate Redis storage and queued Firestore write
    await storeUserData(uid, userData);

    res.status(200).json({ message: "Course interest status saved to Redis, queued for Firestore batch write" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


onBoardingRouter.get('/course-interest/:uid', async (req, res) => {
  const { uid } = req.params;

  if (!uid) {
    return res.status(400).json({ error: "UID is required" });
  }

  try {
    let hasCourse = false;
    let hasInterests = false;
    let subjects = [];
    let interests = [];
    let course = [];
    let fromCache = false;

    // Try to get from Redis first
    if (redisConnectionClient) {
      try {
        const userData = await redisConnectionClient.hGetAll(`user:${uid}`);
        
        if (userData && Object.keys(userData).length > 0) {
          // Redis stores these as strings "true"/"false"
          hasCourse = userData.hasCourse === 'true' || userData.hasCourse === true;
          hasInterests = userData.hasInterests === 'true' || userData.hasInterests === true;
          fromCache = true;
        }

        // Get arrays from separate Redis keys
        const [subjectsData, interestsData, courseData] = await Promise.all([
          redisConnectionClient.get(`subjects:${uid}`),
          redisConnectionClient.get(`interests:${uid}`),
          redisConnectionClient.get(`course:${uid}`)
        ]);

        if (subjectsData) subjects = JSON.parse(subjectsData);
        if (interestsData) interests = JSON.parse(interestsData);
        if (courseData) course = JSON.parse(courseData);

      } catch (redisError) {
        console.error('Redis error, falling back to Firestore:', redisError.message);
        fromCache = false;
      }
    }

    // If not in Redis, get from Firestore and save to Redis
    if (!fromCache) {
      const userRef = db.collection('Users').doc(uid);
      const userSnap = await userRef.get();
      
      if (userSnap.exists) {
        const data = userSnap.data();
        hasCourse = data.hasCourse || false;
        hasInterests = data.hasInterests || false;
        subjects = data.subjects || [];
        interests = data.interests || [];
        course = data.course || [];
        
        // Save to Redis for future requests
        if (redisConnectionClient) {
          try {
            // Save flags to user hash
            await redisConnectionClient.hSet(`user:${uid}`, {
              hasCourse: String(hasCourse),
              hasInterests: String(hasInterests)
            });
            await redisConnectionClient.expire(`user:${uid}`, 1728000); // 20 days

            // Save arrays to separate keys
            if (subjects.length > 0) {
              await redisConnectionClient.set(`subjects:${uid}`, JSON.stringify(subjects), { EX: 1728000 });
            }
            if (interests.length > 0) {
              await redisConnectionClient.set(`interests:${uid}`, JSON.stringify(interests), { EX: 1728000 });
            }
            if (course.length > 0) {
              await redisConnectionClient.set(`course:${uid}`, JSON.stringify(course), { EX: 1728000 });
            }
          } catch (redisError) {
            console.error('Failed to cache in Redis:', redisError.message);
          }
        }
      }
    }

    res.status(200).json({ 
      hasCourse, 
      hasInterests,
      subjects,
      interests,
      course,
      fromCache 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


onBoardingRouter.post('/course-selection', async (req, res) => {
  const { uid, course } = req.body;

  if (!uid || !Array.isArray(course) || course.length === 0) {
    return res.status(400).json({ error: "Both uid and course (as array) are required." });
  }

  try {
    const userData = {
      course
    };

    // Use batch writer for immediate Redis storage and queued Firestore write
    await storeUserData(uid, userData);

    res.status(200).json({ message: "Courses saved to Redis, queued for Firestore batch write" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


onBoardingRouter.post('/academic-preferences', async (req, res) => {
  const { uid, subjects } = req.body;

  if (!uid || !Array.isArray(subjects)) {
    return res.status(400).json({ error: "Fields uid and subjects are required as an array." });
  }

  try {
    const userData = {
      subjects
    };

    // Use batch writer for immediate Redis storage and queued Firestore write
    await storeUserData(uid, userData);

    res.status(200).json({ message: "Subjects saved to Redis, queued for Firestore batch write" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


onBoardingRouter.post('/interests', async (req, res) => {
  const { uid, interests } = req.body;

  if (!uid || !Array.isArray(interests)) {
    return res.status(400).json({ error: "Fields uid and interests (as array) are required." });
  }

  try {
    const userData = {
      interests,
      hasInterests: true,
      updatedAt: new Date()
    };

    // Use batch writer for immediate Redis storage and queued Firestore write
    await storeUserData(uid, userData);

    res.status(200).json({ message: "Interests saved to Redis, queued for Firestore batch write" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


onBoardingRouter.get('/avatars', async (req, res) => {
  try {
    const urlDocRef = db.collection("avatars").doc("url");
    const urlDocSnap = await urlDocRef.get();
    
    if (urlDocSnap.exists) {
      const data = urlDocSnap.data();
      res.status(200).json({ avatars: data.URLs || [] });
    } else {
      res.status(404).json({ error: "Avatars not found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});






module.exports = { onBoardingRouter };
