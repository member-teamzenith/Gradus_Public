const express = require('express');
const router = require('express')
const cors = require('cors');
const { admin, db } = require("../firebase.js");
const { YouTube } = require('youtube-sr');
const { connectRedis } = require("../config/redis.config");

let redisConnectionClient;

(async () => {
  redisConnectionClient = await connectRedis();
})();

const videoRouter = express.Router();

videoRouter.get('/fetchAcademicCategorizedVideos', async (req, res) => {
  const { email } = req.query;

  try {

    const user = await admin.auth().getUserByEmail(email);
    const uid = user.uid;

    let subjects = [];
    let grade = '';
    let redisHit = false;

    // Try to get from Redis first
    if (redisConnectionClient) {
      try {
        const [subjectsData, userData] = await Promise.all([
          redisConnectionClient.get(`subjects:${uid}`),
          redisConnectionClient.hGetAll(`user:${uid}`)
        ]);

        if (subjectsData) subjects = JSON.parse(subjectsData);
        if (userData && userData.course) {
          grade = userData.course;
          redisHit = true;
        }
      } catch (redisError) {
        console.error('Redis error, falling back to Firestore:', redisError.message);
      }
    }

    // Fallback to Firestore if Redis miss
    if (!redisHit) {
      const userDoc = await db.collection("Users").doc(uid).get();
      const userData = userDoc.data();
      subjects = userData.subjects || [];
      grade = userData.course || '';

      // Cache to Redis for future requests
      if (redisConnectionClient) {
        try {
          if (subjects.length > 0) {
            await redisConnectionClient.set(`subjects:${uid}`, JSON.stringify(subjects), { EX: 1728000 });
          }
          if (grade) {
            await redisConnectionClient.hSet(`user:${uid}`, { course: grade });
            await redisConnectionClient.expire(`user:${uid}`, 1728000);
          }
        } catch (cacheError) {
          console.error('Failed to cache in Redis:', cacheError.message);
        }
      }
    }

    const categories = subjects;
    subjects = subjects.map(i => i = `${i} for ${grade} standard`)
    const srcCategories = subjects

    let categorizedVideos = {};
    let i = 0;

    for (const category of srcCategories) {
      categorizedVideos[categories[i]] = [];
      try {
        const result = await YouTube.search(category);
        const videos = result.filter((item) => item.duration >= 60000 * 4)

        categorizedVideos[categories[i]] = videos.map((item) => ({
          videoId: item.id,
          title: item.title,
          channelName: item.channel.name,
          thumbnail: item.thumbnail.url
        }));
        i++;

      } catch (error) {
        console.error(`Error fetching videos for ${category}:`, error.message);
        categorizedVideos[category] = [];
      }
    }

    res.status(200).json({ message: "Videos categorized successfully", categorizedVideos });

  } catch (error) {
    // console.log(error)
    res.status(400).json({ error: error });
  }
});


videoRouter.get('/fetchCategorizedVideos', async (req, res) => {
  const { email } = req.query;
  console.log(email);

  try {
    const user = await admin.auth().getUserByEmail(email);
    const uid = user.uid;

    let interests = [];

    // Try to get from Redis first
    if (redisConnectionClient) {
      try {
        const interestsData = await redisConnectionClient.get(`interests:${uid}`);
        if (interestsData) {
          interests = JSON.parse(interestsData);
        }
      } catch (redisError) {
        console.error('Redis error, falling back to Firestore:', redisError.message);
      }
    }

    // Fallback to Firestore if Redis miss
    if (!interests || interests.length === 0) {
      const userDoc = await db.collection("Users").doc(uid).get();
      interests = userDoc.data()?.interests || [];

      // Cache to Redis for future requests
      if (redisConnectionClient && interests.length > 0) {
        try {
          await redisConnectionClient.set(`interests:${uid}`, JSON.stringify(interests), { EX: 1728000 });
        } catch (cacheError) {
          console.error('Failed to cache in Redis:', cacheError.message);
        }
      }
    }

    if (!interests || interests.length === 0) {
      return res.status(400).json({ error: "User has no interests set" });
    }

    let categorizedVideos = {};

    for (const interest of interests) {
      try {
        const response = await YouTube.search(`${interest} tutorials & course`, { limit: 20 });

        categorizedVideos[interest] = response
          .filter((item) => item.duration >= 120000) // Exclude videos shorter than 120 seconds
          .map((item) => ({
            videoId: item.id,
            title: item.title,
            thumbnail: item.thumbnail.url,
            channelName: item.channel.name,
            url: item.url,
            views: item.views,
            uploadedAt: item.uploadedAt,
            duration: item.durationFormatted, // Include formatted duration
          }));

      } catch (error) {
        console.error(`Error fetching videos for ${interest}:`, error.message);
        categorizedVideos[interest] = [];
      }
    }

    res.status(200).json({ message: "Videos categorized successfully", categorizedVideos });

  } catch (error) {
    console.error("Error fetching user interests:", error.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

videoRouter.get('/fetchAllVideos/:uid', async (req, res) => {
  const { uid } = req.params;

  if (!uid) {
    return res.status(400).json({ error: "UID parameter is required" });
  }

  try {

    let subjects = [];
    let interests = [];
    let courseArray = [];
    let hasRedisData = false;

    // Try to get from Redis first
    if (redisConnectionClient) {
      try {
        const [subjectsData, interestsData, courseData] = await Promise.all([
          redisConnectionClient.get(`subjects:${uid}`),
          redisConnectionClient.get(`interests:${uid}`),
          redisConnectionClient.get(`course:${uid}`)
        ]);

        // If any Redis key exists, we have data from Redis
        if (subjectsData !== null || interestsData !== null || courseData !== null) {
          hasRedisData = true;
        }

        if (subjectsData) subjects = JSON.parse(subjectsData);
        if (interestsData) interests = JSON.parse(interestsData);
        if (courseData) courseArray = JSON.parse(courseData);
      } catch (redisError) {
        console.error('Redis error, falling back to Firestore:', redisError.message);
      }
    }

    // Fallback to Firestore only if we don't have any Redis keys at all
    if (!hasRedisData) {
      const userDoc = await db.collection("Users").doc(uid).get();

      if (!userDoc.exists) {
        console.error(`User document not found for uid: ${uid}`);
        return res.status(404).json({ error: "User data not found. Please complete your profile." });
      }

      const userData = userDoc.data();

      if (!userData) {
        console.error(`User data is empty for uid: ${uid}`);
        return res.status(404).json({ error: "User data is empty. Please complete your profile." });
      }

      subjects = userData.subjects || [];
      interests = userData.interests || [];
      courseArray = userData.course || [];

      // Cache to Redis for future requests
      if (redisConnectionClient) {
        try {
          if (subjects.length > 0) {
            await redisConnectionClient.set(`subjects:${uid}`, JSON.stringify(subjects), { EX: 1728000 });
          }
          if (interests.length > 0) {
            await redisConnectionClient.set(`interests:${uid}`, JSON.stringify(interests), { EX: 1728000 });
          }
          if (courseArray.length > 0) {
            await redisConnectionClient.set(`course:${uid}`, JSON.stringify(courseArray), { EX: 1728000 });
          }
        } catch (cacheError) {
          console.error('Failed to cache in Redis:', cacheError.message);
        }
      }
    }

    // Return queries for frontend to fetch videos via extension
    const queries = {};

    // Check if queries are cached in Redis first
    let cachedQueries = null;
    if (redisConnectionClient) {
      try {
        const queriesCache = await redisConnectionClient.get(`queries:${uid}`);
        if (queriesCache) {
          cachedQueries = JSON.parse(queriesCache);
        }
      } catch (redisError) {
        console.error('Error fetching queries from Redis cache:', redisError.message);
      }
    }

    // If cached queries exist, use them
    if (cachedQueries) {
      // Pick random query for each subject before sending to frontend
      const randomizedQueries = {};
      for (const [key, value] of Object.entries(cachedQueries)) {
        if (Array.isArray(value)) {
          // Pick random query from array
          randomizedQueries[key] = value[Math.floor(Math.random() * value.length)];
        } else {
          randomizedQueries[key] = value;
        }
      }

      return res.status(200).json({
        message: "Queries fetched successfully",
        queries: randomizedQueries
      });
    }

    // 1. Academic queries - fetch from Firebase
    if (courseArray.length > 0 && subjects.length > 0) {
      for (const subject of subjects) {
        let foundQueries = null;

        // Search through all courses to find the subject
        for (const course of courseArray) {
          try {
            const queriesDoc = await db
              .doc(`GlobalDB/Academia/${course}/Subjects/${subject}/Queries`)
              .get();

            if (queriesDoc.exists) {
              const options = queriesDoc.data()?.Options;
              if (options && Array.isArray(options) && options.length > 0) {
                foundQueries = options;
                break; // Found the subject, no need to check other courses
              }
            }
          } catch (error) {
            console.error(`Error fetching queries for ${subject} in ${course}:`, error.message);
            continue; // Try next course
          }
        }

        // If queries found, use them; otherwise fallback to default query
        if (foundQueries) {
          queries[subject] = foundQueries;
        } else {
          // Fallback query without using grade
          queries[subject] = `${subject} tutorials & course`;
        }
      }
    }

    // 2. Interest queries - fetch from Firebase
    for (const interest of interests) {
      let foundQueries = null;

      // Sanitize interest name - replace forward slashes with underscores (to match upload)
      const sanitizedInterest = interest.replace(/\//g, '_');

      try {
        const queriesDoc = await db
          .doc(`GlobalDB/Beyond/${sanitizedInterest}/Queries`)
          .get();

        if (queriesDoc.exists) {
          const options = queriesDoc.data()?.Options;
          if (options && Array.isArray(options) && options.length > 0) {
            foundQueries = options;
          }
        }
      } catch (error) {
        console.error(`Error fetching queries for ${interest}:`, error.message);
      }

      // If queries found, use them; otherwise fallback to default query
      if (foundQueries) {
        queries[interest] = foundQueries;
      } else {
        queries[interest] = `${interest} tutorials & course`;
      }
    }

    // Cache queries in Redis with 30 min TTL (1800 seconds)
    if (redisConnectionClient && Object.keys(queries).length > 0) {
      try {
        await redisConnectionClient.set(`queries:${uid}`, JSON.stringify(queries), { EX: 1800 });
      } catch (cacheError) {
        console.error('Failed to cache queries in Redis:', cacheError.message);
      }
    }

    // Pick random query for each subject before sending to frontend
    const randomizedQueries = {};
    for (const [key, value] of Object.entries(queries)) {
      if (Array.isArray(value)) {
        // Pick random query from array
        randomizedQueries[key] = value[Math.floor(Math.random() * value.length)];
      } else {
        randomizedQueries[key] = value;
      }
    }

    res.status(200).json({
      message: "Queries fetched successfully",
      queries: randomizedQueries
    });

  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ error: error.message || "Something went wrong" });
  }
});

videoRouter.get('/fetchVideos/:category', async (req, res) => {
  const { email, zone } = req.query;
  // console.log(zone)
  const srcQuery = decodeURIComponent(req.params.category);
  let playlists = {};

  try {
    const user = await admin.auth().getUserByEmail(email);
    const uid = user.uid;

    let subjects = [];
    let grade = '';
    let redisHit = false;

    // Try to get from Redis first
    if (redisConnectionClient) {
      try {
        const [subjectsData, userData] = await Promise.all([
          redisConnectionClient.get(`subjects:${uid}`),
          redisConnectionClient.hGetAll(`user:${uid}`)
        ]);

        if (subjectsData) subjects = JSON.parse(subjectsData);
        if (userData && userData.course) {
          grade = userData.course;
          redisHit = true;
        }
      } catch (redisError) {
        console.error('Redis error, falling back to Firestore:', redisError.message);
      }
    }

    // Fallback to Firestore if Redis miss
    if (!redisHit) {
      const userDoc = await db.collection("Users").doc(uid).get();
      const userData = userDoc.data();
      subjects = userData.subjects || [];
      grade = userData.course || '';

      // Cache to Redis for future requests
      if (redisConnectionClient) {
        try {
          if (subjects.length > 0) {
            await redisConnectionClient.set(`subjects:${uid}`, JSON.stringify(subjects), { EX: 1728000 });
          }
          if (grade) {
            await redisConnectionClient.hSet(`user:${uid}`, { course: grade });
            await redisConnectionClient.expire(`user:${uid}`, 1728000);
          }
        } catch (cacheError) {
          console.error('Failed to cache in Redis:', cacheError.message);
        }
      }
    }

    const result = await YouTube.search(srcQuery, { limit: 50 })
    const videos = result.filter((item) => item.duration >= 60000 * 4) // Exclude videos shorter than 120 seconds
      .map((item) => ({
        videoId: item.id,
        title: item.title,
        thumbnail: item.thumbnail.url,
        channelName: item.channel.name,

      }));


    if (zone === "beyond") {
      const playlistDoc = await db
        .collection("GlobalDB")
        .doc("Beyond")
        .collection(srcQuery)
        .doc("Playlists")
        .get();
      // console.log("in beyond")
      const playlistIds = playlistDoc.data()?.Options.slice(1);
      for (const playId of playlistIds) {
        const data = await YouTube.getPlaylist(`https://www.youtube.com/playlist?list=${playId}`);
        if (!data) continue;
        const playName = data.title;
        const channelName = data.channel.name;
        const playThumbnail = data.thumbnail.url;

        playlists[playId] = {
          channelName,
          playThumbnail,
          playName,
        };
        console.log(playlists[playId])
      }
    } else if (zone === "academia") {
      let categoryPath = "";
      // console.log(subjects)
      if (subjects.includes(srcQuery)) {
        categoryPath = `/GlobalDB/Academia/${grade}/Subjects/${srcQuery}/Playlists`;
      }

      if (categoryPath) {
        // console.log(categoryPath)
        const playlistDoc = await db.doc(categoryPath).get();
        const playlistIds = playlistDoc.data()?.Options.slice(1) || [];
        // console.log(playlistIds)
        // console.log(playlistIds)
        for (const playId of playlistIds) {
          const data = await YouTube.getPlaylist(`https://www.youtube.com/playlist?list=${playId}`);
          if (!data) continue
          const playName = data.title;
          const channelName = data.channel.name;
          const playThumbnail = data.thumbnail.url;

          playlists[playId] = {
            channelName,
            playThumbnail,
            playName,
          };
        }
      }
    }

    res.status(200).json({ message: "Videos fetched successfully", videos, playlists });
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = { videoRouter }