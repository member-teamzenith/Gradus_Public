const express = require('express');
const router = require('express')
const cors = require('cors');  // Import the cors package
const { admin, db } = require("../firebase.js");
const { YouTube } = require('youtube-sr');

const searchRouter = express.Router()
const cache = new Map();
const CACHE_DURATION = 1000 * 60 * 60;


searchRouter.get('/search-videos', async(req,res)=>{
    try{
      const {query} = req.query;

      const srcResults = await YouTube.search(query);
      let videos = srcResults
      .filter((item)=> item.duration > 120000)
      .map((item)=> ({
        videoId : item.id,
        title : item.title,
        thumbnail : item.thumbnail.url,
        channelName : item.channel.name
      }));

      res.json({videos})
    }catch(error){
      // console.log(error)
    }
})
// i dont whether it is used on or not, but keeping it to be on safer side
searchRouter.post('/save-notes/:videoId', async (req, res) => {
  try {
      const { notes, email } = req.body;
      const { videoId } = req.params;

      const user = await admin.auth().getUserByEmail(email);
      const userRef = db.collection("users").doc(user.uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
          return res.status(404).json({ error: "User not found" });
      }

      
      const existingNotes = userDoc.data().notes || {};

      
      existingNotes[videoId] = notes;

      
      const updatedUser = await userRef.update({ notes: existingNotes });

      res.status(200).json({ message: "Notes saved successfully", updatedUser });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});



searchRouter.post('/search', async (req, res) => {
    const { query, maxResults } = req.body;
  
    if (!query || !maxResults) {
      return res.status(400).json({ error: 'Query and maxResults are required' });
    }
  
    try {
      // Check cache first
      const cacheKey = `${query}_${maxResults}`;
      const cachedResult = cache.get(cacheKey);
      
      if (cachedResult && (Date.now() - cachedResult.timestamp < CACHE_DURATION)) {
        return res.json(cachedResult.data);
      }
  
      // Normalize and clamp limits to avoid heavy requests and reduce redirect issues
      const desired = Number.isFinite(Number(maxResults)) ? Number(maxResults) : 3;
      const limit = Math.max(1, Math.min(10, Math.floor(desired))); // 1..10

      // If not in cache, fetch from YouTube with resilient options
      const commonOpts = {
        type: 'video',
        safeSearch: true,
        requestOptions: {
          // Help avoid consent/region redirect loops
          headers: {
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "accept-language": "en-US,en;q=0.9",
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "upgrade-insecure-requests": "1",
            "cookie": "CONSENT=YES+1"
          }          
        }
      };

      let results;
      try {
        results = await YouTube.search(query, { ...commonOpts, limit });
      } catch (primaryErr) {
        // Retry once with safer settings if redirect/consent issues occur
        const msg = String(primaryErr?.message || primaryErr);
        const looksLikeRedirectIssue = /redirect/i.test(msg) || /fetch failed/i.test(msg) || /ECONNRESET|ENOTFOUND/i.test(msg);
        if (!looksLikeRedirectIssue) throw primaryErr;
        try {
          results = await YouTube.search(query, { type: 'video', safeSearch: false, limit: Math.max(1, Math.min(5, limit)), requestOptions: commonOpts.requestOptions });
        } catch (secondaryErr) {
          console.error('YouTube search retry failed:', secondaryErr?.message || secondaryErr);
          throw primaryErr; // surface original
        }
      }
  
      const videoDetails = [];
      const videoIds = new Set();
  
      for (const video of results) {
        if (videoDetails.length >= limit) break;
        
        // Convert duration to seconds if it's not already in seconds
        const durationInSeconds = video.duration;
        
        if (!videoIds.has(video.id) && durationInSeconds && durationInSeconds >= 120) {
          videoDetails.push({
            kind: "youtube#video",
            id: video.id,
            snippet: {
              title: video.title,
              description: video.description || "",
              channelId: video.channel.id,
              channelTitle: video.channel.name,
              thumbnail: `https://img.youtube.com/vi/${video.id}/sddefault.jpg`
            },
            contentDetails: {
              duration: durationInSeconds
            }
          });
          videoIds.add(video.id);
        }
      }
  
      const response = {
        kind: "youtube#searchListResponse",
        items: videoDetails
      };
  
      // Store in cache
      cache.set(cacheKey, {
        timestamp: Date.now(),
        data: response
      });
  
      res.json(response);
    } catch (error) {
      console.error('Error searching YouTube:', error);
      res.status(502).json({ error: 'Failed to search YouTube', details: String(error?.message || error) });
    }
  });

  module.exports = {searchRouter}