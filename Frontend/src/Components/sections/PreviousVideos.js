"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { auth } from "../../lib/Firebase";
import { fetchUserNotes } from "@/services/userServices";

const PreviousVideos = () => {
  const [previousVideos, setPreviousVideos] = useState([]);
  const [userId, setUserId] = useState(null);
  const router = useRouter();
  const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

  useEffect(() => {
    const fetchUser = async () => {
      const user = auth.currentUser;
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    };

    fetchUser();
    const unsubscribe = auth.onAuthStateChanged(fetchUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchVideoDetails = async (videoId) => {
      try {
        // Try using noembed API first (no API key required)
        const noembedResponse = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        if (noembedResponse.ok) {
          const data = await noembedResponse.json();
          if (data.title) {
            return data.title;
          }
        }
      } catch (noembedError) {
        console.log("Noembed API failed, trying YouTube API:", noembedError);
      }

      // Fallback to YouTube API if noembed fails
      try {
        if (YOUTUBE_API_KEY) {
          const response = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
            params: {
              part: "snippet",
              id: videoId,
              key: YOUTUBE_API_KEY,
            },
          });
          return response.data.items[0]?.snippet?.title || "Untitled Video";
        }
      } catch (error) {
        console.log("YouTube API failed:", error.message);
      }
      
      // Final fallback
      return "Untitled Video";
    };

    const fetchPreviousVideos = async () => {
      try {
        const response = await fetchUserNotes(userId);
        const notes = response.notes || {};

        // Handle case where user has no notes/videos
        if (Object.keys(notes).length === 0) {
          setPreviousVideos([]);
          return;
        }

        let videosArray = Object.entries(notes)
          .map(([videoId, data]) => {
            // Handle timestamps from different sources:
            // - Redis cache: ISO string or numeric timestamp
            // - Firestore: Timestamp object with toDate() method or ISO string
            let timestamp = new Date();
            
            if (data.timestamp) {
              if (typeof data.timestamp === 'string') {
                // ISO string from Redis or Firestore
                timestamp = new Date(data.timestamp);
              } else if (typeof data.timestamp === 'number') {
                // Unix timestamp (milliseconds)
                timestamp = new Date(data.timestamp);
              } else if (data.timestamp.toDate && typeof data.timestamp.toDate === 'function') {
                // Firestore Timestamp object
                timestamp = data.timestamp.toDate();
              } else if (data.timestamp instanceof Date) {
                // Already a Date object
                timestamp = data.timestamp;
              } else if (data.timestamp._seconds !== undefined) {
                // Firestore timestamp serialized as plain object
                timestamp = new Date(data.timestamp._seconds * 1000);
              }
            }
            
            return {
              videoId,
              ...data,
              thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
              timestamp: timestamp,
            };
          })
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 10);

        const videosWithTitles = await Promise.all(
          videosArray.map(async (video) => ({
            ...video,
            title: await fetchVideoDetails(video.videoId),
          }))
        );

        setPreviousVideos(videosWithTitles);
      } catch (error) {
        console.error("Error fetching previous videos:", error);
        // Don't show error to user, just set empty array
        setPreviousVideos([]);
      }
    };

    fetchPreviousVideos();
  }, [userId]);

  const handleVideoClick = (videoId) => {
    router.push(`/videoplayer/${videoId}`);
  };

  const formatDate = (date) => {
    const now = new Date();
    const timeDiff = now - date;
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return "today";
    } else if (days === 1) {
      return "yesterday";
    } else if (days >= 30) {
      const months = Math.floor(days / 30);
      return months === 1 ? "1 month ago" : `${months} months ago`;
    } else {
      return `${days} days ago`;
    }
  };


  if (!userId) {
    return <p className="text-gray-500 p-4 text-center">Please log in to view your previous videos.</p>;
  }

  return (
    <div className="p-4 bg-black text-white">
      <h2 className="text-2xl font-bold mb-6 text-center">Previous Videos</h2>

      <div className="grid grid-cols-1 gap-4">
        {previousVideos.map((video) => (
          <div
            key={video.videoId}
            className="flex items-center space-x-4 border border-green-200 rounded p-2 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-green-500/20 hover:border-green-400"
            onClick={() => handleVideoClick(video.videoId)}
          >
            <div className="flex-shrink-0">
              <img
                src={video.thumbnail}
                alt={`Thumbnail for ${video.title}`}
                width={144}
                height={90}
                className="w-36 h-auto rounded-md"
              />
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-semibold">{video.title}</h3>
              <p className="text-sm text-green-300 mt-1">Viewed {formatDate(video.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>

      {previousVideos.length === 0 && (
        <p className="text-center text-gray-400 mt-8">No previous videos found</p>
      )}
    </div>
  );
};

export default PreviousVideos;
