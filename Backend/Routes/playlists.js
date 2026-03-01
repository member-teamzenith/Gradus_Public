const express = require('express');
// const router = require('express')
const cors = require('cors');  // Import the cors package
const { admin, db } = require("../firebase.js");
const { YouTube } = require('youtube-sr');
const { connectRedis } = require("../config/redis.config");
const { storeUserData } = require('../utils/batchWriter');
const axios = require("axios");
const cheerio = require("cheerio");


let redisConnectionClient;

(async () => {
  redisConnectionClient = await connectRedis();
})();

async function cacheAllUserZonePlaylists(zoneKey, userId, playlistIds, fetchFuncForId) {
  let playlistsObj = {};
  if (redisConnectionClient) {
    let cached = await redisConnectionClient.get(`${zoneKey}:${userId}`);
    playlistsObj = cached ? JSON.parse(cached) : {};

    let isUpdated = false;
    // Fetch any missing playlists and add to cache.
    for (const playId of playlistIds) {
      if (!playlistsObj[playId]) {
        const playlist = await fetchFuncForId(playId);
        if (playlist) {
          playlistsObj[playId] = playlist;
          isUpdated = true;
        }
      }
    }
    if (isUpdated) {
      await redisConnectionClient.set(
        `${zoneKey}:${userId}`,
        JSON.stringify(playlistsObj)
      );
    }
  } else {
    // No redis, fetch everything live
    for (const playId of playlistIds) {
      playlistsObj[playId] = await fetchFuncForId(playId);
    }
  }
  return playlistsObj;
}

const playlistRouter = express.Router();

playlistRouter.get('/playlist/:playlistId', async (req, res) => {
  const { playlistId } = req.params;
  let playlist = {};
  const YT_KEY = process.env.YT_KEY;
  const YT_KEY_2 = process.env.YT_KEY_2;

  const data = await YouTube.getPlaylist(`https://www.youtube.com/playlist?list=${playlistId}`, { fetchAll: true });

  if (data) {
    playlist = {
      playListName: data.title,
      channelName: data.channel.name,
      playlistThumbnail: data.thumbnail.url,
      totalVideos: data.videos.length,
      nextPageToken: null,
      videos: data.videos.map(video => ({
        videoId: video.id,
        videoTitle: video.title,
        videoThumbnail: video.thumbnail.url
      }))
    };
    return res.json(playlist);
  }


  else if (!data) {
    try {
      const ytResponse = await axios.get(`https://www.googleapis.com/youtube/v3/playlists`, {
        params: {
          part: 'snippet,contentDetails',
          id: playlistId,
          key: YT_KEY
        }
      });

      if (ytResponse.data.items.length > 0) {
        const playlistDetails = ytResponse.data.items[0].snippet;
        const totalVideos = ytResponse.data.items[0].contentDetails?.itemCount || 0;

        playlist = {
          playListName: playlistDetails.title,
          channelName: playlistDetails.channelTitle,
          playlistThumbnail: playlistDetails.thumbnails?.high?.url || '',
          totalVideos,
          videos: []
        };

        const videosResponse = await axios.get(`https://www.googleapis.com/youtube/v3/playlistItems`, {
          params: {
            part: 'snippet',
            playlistId: playlistId,
            maxResults: 50,
            key: YT_KEY_2
          }
        });

        playlist.videos = videosResponse.data.items.map(item => ({
          videoId: item.snippet.resourceId.videoId,
          videoTitle: item.snippet.title,
          videoThumbnail: item.snippet.thumbnails?.high?.url || ''
        }));

        return res.json(playlist);
      }
    } catch (ytError) {
      console.error('YouTube Data API error:', ytError.message);
      return res.status(500).json({ error: 'Failed to fetch playlist data' });
    }
  }

  res.status(404).json({ error: 'Playlist not found' });
});

playlistRouter.get('/getPlaylists/academia', async (req, res) => {
  const { email } = req.query;
  try {
    const user = await admin.auth().getUserByEmail(email);
    const uid = user.uid;

    let grade = '';
    let examCategories = [];
    let subjects = [];
    let redisHit = false;

    // Try to get from Redis first
    if (redisConnectionClient) {
      try {
        const [subjectsData, examsData, userData] = await Promise.all([
          redisConnectionClient.get(`subjects:${uid}`),
          redisConnectionClient.get(`exams:${uid}`),
          redisConnectionClient.hGetAll(`user:${uid}`)
        ]);
        // console.log("fetched user data from redis")
        if (subjectsData) subjects = JSON.parse(subjectsData);
        if (examsData) examCategories = JSON.parse(examsData);
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
      grade = userData.course || '';
      examCategories = userData.exams || [];
      subjects = userData.subjects || [];

      // Cache to Redis for future requests
      if (redisConnectionClient) {
        try {
          if (subjects.length > 0) {
            await redisConnectionClient.set(`subjects:${uid}`, JSON.stringify(subjects), { EX: 1728000 });
          }
          if (examCategories.length > 0) {
            await redisConnectionClient.set(`exams:${uid}`, JSON.stringify(examCategories), { EX: 1728000 });
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

    if (!grade) {
      return res.status(400).json({ error: "User grade information is missing." });
    }

    let playlistIds = [];
    for (const exam of examCategories) {
      const examPlaylistDoc = await db.collection("GlobalDB").doc("Academia")
        .collection(grade).doc("Exams").collection(exam)
        .doc("Playlists").get();
      const examPlaylists = examPlaylistDoc.data()?.Options?.slice(1) || [];
      playlistIds.push(...examPlaylists);
    }
    for (const subject of subjects) {
      const subjectPlaylistDoc = await db.collection("GlobalDB").doc("Academia")
        .collection(grade).doc("Subjects").collection(subject)
        .doc("Playlists").get();
      const subjectPlaylists = subjectPlaylistDoc.data()?.Options?.slice(1) || [];
      playlistIds.push(...subjectPlaylists);
    }

    // Cache all possible playlists!
    const allPlaylists = await cacheAllUserZonePlaylists(
      'academia',
      user.uid,
      playlistIds,
      async (playId) => {
        try {
          const playlistRes = await YouTube.getPlaylist(`https://www.youtube.com/playlist?list=${playId}`);
          if (!playlistRes) return null;
          return {
            channelName: playlistRes?.channel?.name,
            playThumbnail: playlistRes?.thumbnail?.url,
            playName: playlistRes?.title,
          };
        } catch (err) {
          console.warn(`Failed to fetch playlist ${playId}: ${err.message}`);
          return null;
        }
      }
    );

    // Pick 5 random playlists from cached collection
    const keys = Object.keys(allPlaylists);
    const randomKeys = keys.sort(() => Math.random() - 0.5).slice(0, 5);
    const playlists = {};
    for (const k of randomKeys) {
      playlists[k] = allPlaylists[k];
    }

    res.json({ playlists });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong." });
  }
});

playlistRouter.get('/getPlaylists/beyond', async (req, res) => {
  const { email } = req.query;
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

    let playlistIds = [];
    for (const interest of interests) {
      const playlistDoc = await db.collection("GlobalDB").doc("Beyond")
        .collection(interest).doc("Playlists").get();
      const playlistArr = playlistDoc.data()?.Options?.slice(1);
      if (playlistArr) playlistIds.push(...playlistArr);
    }

    const allPlaylists = await cacheAllUserZonePlaylists(
      'beyond',
      user.uid,
      playlistIds,
      async (playId) => {
        try {
          const playlistRes = await YouTube.getPlaylist(`https://www.youtube.com/playlist?list=${playId}`);
          if (!playlistRes) return null;
          return {
            channelName: playlistRes?.channel?.name,
            playThumbnail: playlistRes?.thumbnail?.url,
            playName: playlistRes?.title,
          };
        } catch (err) {
          console.warn(`Failed to fetch playlist ${playId}: ${err.message}`);
          return null;
        }
      }
    );

    // Pick 5 random playlists on every load
    const keys = Object.keys(allPlaylists);
    const randomKeys = keys.sort(() => Math.random() - 0.5).slice(0, 5);
    const playlists = {};
    for (const k of randomKeys) {
      playlists[k] = allPlaylists[k];
    }

    res.json({ playlists });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong." });
  }
})

playlistRouter.post("/savePlaylist", async (req, res) => {
  try {
    // console.log("in the router")
    const { userId, playlistData } = req.body;
    // console.log(req.body.userId)
    if (!userId || !playlistData) {
      return res.status(400).json({ message: "User ID and Playlist ID are required." });
    }

    const formattedVideos = {};
    for (const [videoId, video] of Object.entries(playlistData.videos)) {
      formattedVideos[videoId] = {
        ...video,
        seen: false
      };
    }

    const playlistId = db.collection("Users").doc().id;

    const savedPlaylist = {
      channelName: playlistData.channelName,
      playThumbnail: playlistData.playThumbnail,
      playName: playlistData.playName,
      videos: formattedVideos,
      savedAt: new Date().toISOString()
    };

    // Get existing savedPlaylists from Redis or Firestore
    let existingSavedPlaylists = {};

    if (redisConnectionClient) {
      try {
        const cachedPlaylists = await redisConnectionClient.get(`savedPlaylists:${userId}`);
        if (cachedPlaylists) {
          existingSavedPlaylists = JSON.parse(cachedPlaylists);
        }
      } catch (redisError) {
        console.error('Redis error, falling back to Firestore:', redisError.message);
      }
    }

    // If not in Redis, get from Firestore
    if (Object.keys(existingSavedPlaylists).length === 0) {
      const userDoc = await db.collection("Users").doc(userId).get();
      if (userDoc.exists) {
        existingSavedPlaylists = userDoc.data()?.savedPlaylists || {};
      }
    }

    // Add new playlist to existing playlists
    existingSavedPlaylists[playlistId] = savedPlaylist;

    // Use batch writer for immediate Redis storage and queued Firestore write
    await storeUserData(userId, { savedPlaylists: existingSavedPlaylists });

    res.status(200).json({ message: "Playlist saved successfully.", playlistId });

  } catch (error) {
    console.error("Error saving playlist:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET saved playlist by userId and playlistId
playlistRouter.get('/playlist/:userId/:playlistId', async (req, res) => {
  try {
    const { userId, playlistId } = req.params;

    let savedPlaylists = {};

    // Try to get from Redis first
    if (redisConnectionClient) {
      try {
        const cachedPlaylists = await redisConnectionClient.get(`savedPlaylists:${userId}`);
        if (cachedPlaylists) {
          savedPlaylists = JSON.parse(cachedPlaylists);
        }
      } catch (redisError) {
        console.error('Redis error, falling back to Firestore:', redisError.message);
      }
    }

    // Fallback to Firestore if Redis miss
    if (Object.keys(savedPlaylists).length === 0) {
      const userDoc = await db.collection("Users").doc(userId).get();
      if (userDoc.exists) {
        savedPlaylists = userDoc.data()?.savedPlaylists || {};

        // Cache to Redis for future requests
        if (redisConnectionClient && Object.keys(savedPlaylists).length > 0) {
          try {
            await redisConnectionClient.set(`savedPlaylists:${userId}`, JSON.stringify(savedPlaylists), { EX: 1728000 });
          } catch (cacheError) {
            console.error('Failed to cache in Redis:', cacheError.message);
          }
        }
      }
    }

    const playlist = savedPlaylists[playlistId];

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    res.status(200).json({ playlist });

  } catch (error) {
    console.error('Error fetching saved playlist:', error);
    res.status(500).json({ error: error.message });
  }
});

// UPDATE video seen status in saved playlist
playlistRouter.patch('/playlist/:userId/:playlistId/:videoId/seen', async (req, res) => {
  try {
    const { userId, playlistId, videoId } = req.params;
    const { seen } = req.body;

    if (typeof seen !== 'boolean') {
      return res.status(400).json({ error: 'seen must be a boolean' });
    }

    let savedPlaylists = {};

    // Get from Redis first
    if (redisConnectionClient) {
      try {
        const cachedPlaylists = await redisConnectionClient.get(`savedPlaylists:${userId}`);
        if (cachedPlaylists) {
          savedPlaylists = JSON.parse(cachedPlaylists);
        }
      } catch (redisError) {
        console.error('Redis error, falling back to Firestore:', redisError.message);
      }
    }

    // Fallback to Firestore if Redis miss
    if (Object.keys(savedPlaylists).length === 0) {
      const userDoc = await db.collection("Users").doc(userId).get();
      if (userDoc.exists) {
        savedPlaylists = userDoc.data()?.savedPlaylists || {};
      }
    }

    // Check if playlist and video exist
    if (!savedPlaylists[playlistId]) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (!savedPlaylists[playlistId].videos[videoId]) {
      return res.status(404).json({ error: 'Video not found in playlist' });
    }

    // Update seen status
    savedPlaylists[playlistId].videos[videoId].seen = seen;

    // Use batch writer for immediate Redis update and queued Firestore write
    await storeUserData(userId, { savedPlaylists });

    res.status(200).json({
      message: 'Video seen status updated successfully',
      seen
    });

  } catch (error) {
    console.error('Error updating seen status:', error);
    res.status(500).json({ error: error.message });
  }
});

playlistRouter.get('/fetchAllPlaylists', async (req, res) => {
  const { email } = req.query;
  try {
    if (!email) return res.status(400).json({ error: "Missing email" });

    const user = await admin.auth().getUserByEmail(email);
    const uid = user.uid;

    // ---------- 1) Get preferences (redis + firestore fallback) ----------
    let subjects = [], exams = [], interests = [], grade = '';
    let redisHit = false;

    if (redisConnectionClient) {
      try {
        const [s, e, it, u] = await Promise.all([
          redisConnectionClient.get(`subjects:${uid}`),
          redisConnectionClient.get(`exams:${uid}`),
          redisConnectionClient.get(`interests:${uid}`),
          redisConnectionClient.hGetAll(`user:${uid}`)
        ]);
        if (s) subjects = JSON.parse(s);
        if (e) exams = JSON.parse(e);
        if (it) interests = JSON.parse(it);
        if (u && u.course) { grade = u.course; redisHit = true; }
      } catch (err) {
        console.error("Redis fetch error:", err.message);
      }
    }

    if (!redisHit || (!grade && subjects.length === 0 && exams.length === 0 && interests.length === 0)) {
      const userDoc = await db.collection("Users").doc(uid).get();
      const data = userDoc.data() || {};
      subjects = data.subjects || [];
      exams = data.exams || [];
      interests = data.interests || [];
      grade = data.course || '';

      if (redisConnectionClient) {
        try {
          if (subjects.length) await redisConnectionClient.set(`subjects:${uid}`, JSON.stringify(subjects), { EX: 1728000 });
          if (exams.length) await redisConnectionClient.set(`exams:${uid}`, JSON.stringify(exams), { EX: 1728000 });
          if (interests.length) await redisConnectionClient.set(`interests:${uid}`, JSON.stringify(interests), { EX: 1728000 });
          if (grade) { await redisConnectionClient.hSet(`user:${uid}`, { course: grade }); await redisConnectionClient.expire(`user:${uid}`, 1728000); }
        } catch (err) { console.error("Redis cache error:", err.message); }
      }
    }

    // ---------- 2) Collect playlist IDs ----------
    const allPlaylistIds = new Set();

    if (grade) {
      for (const subject of subjects) {
        try {
          const docSnap = await db.collection("GlobalDB").doc("Academia").collection(grade).doc("Subjects").collection(subject).doc("Playlists").get();
          const ids = docSnap.data()?.Options?.slice(1) || [];
          ids.forEach(id => id && allPlaylistIds.add(id));
        } catch (err) {
          console.warn("Error reading subjects playlist doc for", subject, err.message);
        }
      }

      for (const exam of exams) {
        try {
          const docSnap = await db.collection("GlobalDB").doc("Academia").collection(grade).doc("Exams").collection(exam).doc("Playlists").get();
          const ids = docSnap.data()?.Options?.slice(1) || [];
          ids.forEach(id => id && allPlaylistIds.add(id));
        } catch (err) {
          console.warn("Error reading exams playlist doc for", exam, err.message);
        }
      }
    }

    for (const interest of interests) {
      try {
        const docSnap = await db.collection("GlobalDB").doc("Beyond").collection(interest).doc("Playlists").get();
        const ids = docSnap.data()?.Options?.slice(1) || [];
        ids.forEach(id => id && allPlaylistIds.add(id));
      } catch (err) {
        console.warn("Error reading beyond playlist doc for", interest, err.message);
      }
    }

    const playlistIds = Array.from(allPlaylistIds);
    // console.log("Playlist IDs collected:", playlistIds);

    // ---------- Helper: Fetch playlist metadata via page scraping ----------
    async function fetchPlaylistMeta(pid) {
      try {
        const url = `https://www.youtube.com/playlist?list=${pid}`;
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          validateStatus: (status) => status === 200
        });

        if (!response.data) return null;

        const $ = cheerio.load(response.data);

        // Method 1: Try to extract from meta tags (most reliable)
        let playName = $('meta[property="og:title"]').attr('content') ||
          $('meta[name="title"]').attr('content');

        let playThumbnail = $('meta[property="og:image"]').attr('content');

        let channelName = $('link[itemprop="name"]').attr('content') ||
          $('span[itemprop="author"] link[itemprop="name"]').attr('content');

        // Method 2: Try to extract from ytInitialData (more reliable for all fields)
        if (!playName || !channelName || !playThumbnail) {
          const scriptTags = $('script').toArray();

          for (const script of scriptTags) {
            const scriptContent = $(script).html();
            if (scriptContent && scriptContent.includes('var ytInitialData = ')) {
              try {
                const match = scriptContent.match(/var ytInitialData = ({.+?});/);
                if (match && match[1]) {
                  const ytData = JSON.parse(match[1]);

                  // Navigate the YouTube data structure
                  const sidebar = ytData?.sidebar?.playlistSidebarRenderer?.items;

                  if (sidebar && sidebar.length > 0) {
                    // Get playlist title
                    const primaryInfo = sidebar[0]?.playlistSidebarPrimaryInfoRenderer;
                    if (primaryInfo && !playName) {
                      playName = primaryInfo.title?.runs?.[0]?.text ||
                        primaryInfo.title?.simpleText;
                    }

                    // Get thumbnail with better quality
                    if (primaryInfo?.thumbnailRenderer?.playlistVideoThumbnailRenderer?.thumbnail?.thumbnails && !playThumbnail) {
                      const thumbnails = primaryInfo.thumbnailRenderer.playlistVideoThumbnailRenderer.thumbnail.thumbnails;
                      // Get the highest quality thumbnail
                      playThumbnail = thumbnails[thumbnails.length - 1]?.url;
                    }

                    // Get channel name
                    const secondaryInfo = sidebar[1]?.playlistSidebarSecondaryInfoRenderer;
                    if (secondaryInfo?.videoOwner?.videoOwnerRenderer?.title && !channelName) {
                      channelName = secondaryInfo.videoOwner.videoOwnerRenderer.title.runs?.[0]?.text;
                    }
                  }

                  // Alternative path for thumbnail if not found above
                  if (!playThumbnail) {
                    const header = ytData?.header?.playlistHeaderRenderer;
                    if (header?.playlistHeaderBanner?.heroPlaylistThumbnailRenderer?.thumbnail?.thumbnails) {
                      const thumbnails = header.playlistHeaderBanner.heroPlaylistThumbnailRenderer.thumbnail.thumbnails;
                      playThumbnail = thumbnails[thumbnails.length - 1]?.url;
                    }
                  }
                }
              } catch (parseErr) {
                // Continue to next script tag if parsing fails
                continue;
              }
            }
          }
        }

        // Fallback: Get title from page title if still not found
        if (!playName) {
          const pageTitle = $('title').text();
          if (pageTitle) {
            // Remove " - YouTube" suffix
            playName = pageTitle.replace(/\s*-\s*YouTube\s*$/, '').trim();
          }
        }

        // Construct fallback thumbnail if still not found
        if (!playThumbnail && playlistIds.length > 0) {
          // YouTube playlist thumbnails often follow this pattern
          playThumbnail = `https://i.ytimg.com/vi/${pid}/hqdefault.jpg`;
        }

        // Return null if we couldn't get at least the playlist name
        if (!playName) {
          console.warn(`Could not extract playlist name for ${pid}`);
          return null;
        }

        return {
          playName: playName.trim(),
          playThumbnail: playThumbnail || null,
          channelName: (channelName || 'Unknown Channel').trim()
        };

      } catch (err) {
        console.warn(`Failed to fetch playlist ${pid}:`, err.message);
        return null;
      }
    }

    // ---------- 3) Batch resolve with retries ----------
    const resolved = {};
    const unresolved = [];
    const batchSize = 3; // Reduced to avoid rate limiting
    const maxRetries = 2;
    let pending = [...playlistIds];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (!pending.length) break;
      const nextPending = [];

      for (let i = 0; i < pending.length; i += batchSize) {
        const batch = pending.slice(i, i + batchSize);

        const promises = batch.map(async (pid, idx) => {
          // Stagger requests to avoid rate limiting
          await new Promise(r => setTimeout(r, 250 * idx));
          const meta = await fetchPlaylistMeta(pid);
          return { pid, meta };
        });

        const settled = await Promise.allSettled(promises);

        for (const s of settled) {
          if (s.status === "fulfilled" && s.value?.meta) {
            resolved[s.value.pid] = s.value.meta;
          } else {
            const pid = s.status === "fulfilled" && s.value ? s.value.pid : null;
            if (pid && attempt < maxRetries) {
              nextPending.push(pid);
            }
          }
        }

        // Pause between batches
        await new Promise(r => setTimeout(r, 400));
      }

      pending = nextPending;

      if (pending.length && attempt < maxRetries) {
        const backoff = 1000 + attempt * 500;
        // console.log(`Retrying ${pending.length} unresolved playlists (attempt ${attempt + 2}/${maxRetries + 1}), backoff ${backoff}ms`);
        await new Promise(r => setTimeout(r, backoff));
      }
    }

    // Mark remaining as unresolved
    if (pending.length) {
      unresolved.push(...pending);
      console.warn(`Failed to resolve ${pending.length} playlists after ${maxRetries + 1} attempts`);
    }

    // console.log(`Successfully resolved ${Object.keys(resolved).length}/${playlistIds.length} playlists`);

    // ---------- 4) Cache resolved map in Redis ----------
    if (redisConnectionClient && Object.keys(resolved).length > 0) {
      try {
        await redisConnectionClient.set(
          `playlists:unified:${uid}`,
          JSON.stringify(resolved),
          { EX: 21600 } // 6 hours cache
        );
        // console.log('Playlist metadata cached in Redis');
      } catch (err) {
        console.error("Redis cache write failed:", err.message);
      }
    }

    // ---------- 5) Construct final response ----------
    const finalPlaylists = {};
    playlistIds.forEach(id => {
      if (resolved[id]) {
        finalPlaylists[id] = resolved[id];
      }
    });

    return res.json({
      playlists: finalPlaylists,
      unresolved: unresolved.slice(0, 50),
      stats: {
        total: playlistIds.length,
        resolved: Object.keys(resolved).length,
        failed: unresolved.length
      }
    });

  } catch (err) {
    console.error("fetchAllPlaylists error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = { playlistRouter }