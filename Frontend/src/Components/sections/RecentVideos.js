'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { selectUser } from '../../../store/userSlice';
import { fetchUserNotes, fetchUserDetails } from '@/services/userServices';
import { fetchVideoSummary } from '@/services/videoPlayerServices';
import SummaryFormatter from '../VideoPlayer/watch/SummaryContainer';
import { searchContent } from '@/pythonServices/VideoPlayerServices';

function RecentVideos() {
  const reduxUser = useSelector(selectUser);
  const [videos, setVideos] = useState([]);
  const [allVideos, setAllVideos] = useState([]); // Store all fetched videos
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userData, setUserData] = useState({ name: 'User', photo: null });
  const [userId, setUserId] = useState(null);
  const [showSummary, setShowSummary] = useState(true);
  const [activeSegment, setActiveSegment] = useState(null); // { start, end }
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      if (reduxUser && reduxUser.uid) {
        setUserId(reduxUser.uid);

        try {
          const result = await fetchUserDetails(reduxUser.uid);
          const data = result?.data ? result.data : result;

          if (data) {
            setUserData({
              name: data.name || data.displayName || reduxUser.displayName || 'User',
              photo: data.photo || data.photoURL || reduxUser.photoURL || null,
            });
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          // Fallback to Redux user data
          setUserData({
            name: reduxUser.displayName || 'User',
            photo: reduxUser.photoURL || null,
          });
        }
      } else {
        setUserId(null);
        setUserData({ name: 'Guest', photo: null });
      }
    };

    fetchUser();
  }, [reduxUser]);

  useEffect(() => {
    if (!userId) return;

    const loadVideosWithNotes = async () => {
      try {
        const response = await fetchUserNotes(userId);
        const notesData = response.notes || {};

        // Handle case where user has no notes/videos
        if (Object.keys(notesData).length === 0) {
          setAllVideos([]);
          setVideos([]);
          setError(null);
          return;
        }

        const videosArray = await Promise.all(Object.entries(notesData)
          .map(async ([key, noteData]) => {
            // Handle timestamps from different sources:
            // - Redis cache: ISO string or numeric timestamp
            // - Firestore: Timestamp object with toDate() method or ISO string
            let timestamp = new Date();

            if (noteData.timestamp) {
              if (typeof noteData.timestamp === 'string') {
                // ISO string from Redis or Firestore
                timestamp = new Date(noteData.timestamp);
              } else if (typeof noteData.timestamp === 'number') {
                // Unix timestamp (milliseconds)
                timestamp = new Date(noteData.timestamp);
              } else if (noteData.timestamp.toDate && typeof noteData.timestamp.toDate === 'function') {
                // Firestore Timestamp object
                timestamp = noteData.timestamp.toDate();
              } else if (noteData.timestamp instanceof Date) {
                // Already a Date object
                timestamp = noteData.timestamp;
              } else if (noteData.timestamp._seconds !== undefined) {
                // Firestore timestamp serialized as plain object
                timestamp = new Date(noteData.timestamp._seconds * 1000);
              }
            }

            let summaryData = null;
            try {
              const summaryResponse = await fetchVideoSummary(key);
              console.log(`Summary fetched for video ${key}:`, summaryResponse);
              if (summaryResponse && summaryResponse.summary) {
                summaryData = summaryResponse.summary;
              }
            } catch (err) {
              console.error(`Error fetching summary for video ${key}:`, err);
            }

            return {
              videoId: key,
              content: noteData.content || '',
              timestamp: timestamp,
              summary: summaryData
            };
          }));

        videosArray.sort((a, b) => b.timestamp - a.timestamp);

        setAllVideos(videosArray);
        if (!isSearching) {
          setVideos(videosArray.slice(0, 5));
        }
        setError(null);
      } catch (error) {
        console.error('Error loading videos:', error);
        // Don't show error to user, just set empty arrays
        setAllVideos([]);
        setVideos([]);
        setError(null);
      }
    };

    loadVideosWithNotes();
  }, [userId]);

  const getPriority = (score) => {
    if (score > 0.7) return { label: 'High', color: 'bg-red-500 text-white' };
    if (score > 0.4) return { label: 'Medium', color: 'bg-yellow-500 text-black' };
    return { label: 'Low', color: 'bg-gray-500 text-white' };
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const data = await searchContent(searchQuery, {
        userId: userId || undefined
      });

      const results = data.results || [];

      if (results.length === 0) {
        setSearchResults([]);
        setShowResults(true);
        return;
      }

      // Group by video_id
      const groupedResults = {};

      results.forEach(result => {
        if (!groupedResults[result.video_id]) {
          groupedResults[result.video_id] = {
            videoId: result.video_id,
            segments: [],
            maxScore: 0
          };
        }
        groupedResults[result.video_id].segments.push(result);
        if (result.score > groupedResults[result.video_id].maxScore) {
          groupedResults[result.video_id].maxScore = result.score;
        }
      });

      // Helper to fetch title
      const fetchVideoTitle = async (videoId) => {
        try {
          const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
          const json = await res.json();
          return json.title || "Untitled Video";
        } catch (error) {
          console.error(`Failed to fetch title for ${videoId}`, error);
          return "Untitled Video";
        }
      };

      // Convert to array and merge with existing video data
      const processedResults = await Promise.all(Object.values(groupedResults).map(async group => {
        const existingVideo = allVideos.find(v => v.videoId === group.videoId);

        let title = "Untitled Video";
        if (existingVideo?.summary?.title) {
          title = existingVideo.summary.title;
        } else {
          title = await fetchVideoTitle(group.videoId);
        }

        return {
          ...group,
          // Use existing data if available, otherwise defaults
          content: existingVideo?.content || '',
          timestamp: existingVideo?.timestamp || new Date(),
          summary: existingVideo?.summary || null,
          title: title,
          priority: getPriority(group.maxScore)
        };
      }));

      processedResults.sort((a, b) => b.maxScore - a.maxScore);

      setSearchResults(processedResults);
      setShowResults(true);

    } catch (err) {
      console.error("Search error:", err);
      setError(err.message);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = async (video) => {
    let videoWithSummary = { ...video };

    // Fetch summary if not present or empty
    if (!videoWithSummary.summary) {
      try {
        const summaryResponse = await fetchVideoSummary(video.videoId);
        console.log(`Summary fetched for video ${video.videoId}:`, summaryResponse);
        if (summaryResponse && summaryResponse.summary) {
          videoWithSummary.summary = summaryResponse.summary;
        }
      } catch (error) {
        console.error("Error fetching summary:", error);
      }
    }

    // 1. Find if this video is already in our main 'videos' list
    const existingIndex = videos.findIndex(v => v.videoId === videoWithSummary.videoId);

    if (existingIndex !== -1) {
      setCurrentIndex(existingIndex);
      const updatedVideos = [...videos];
      updatedVideos[existingIndex] = {
        ...updatedVideos[existingIndex],
        segments: videoWithSummary.segments,
        priority: videoWithSummary.priority,
        // Use the newly fetched summary if our existing one was empty
        summary: videoWithSummary.summary || updatedVideos[existingIndex].summary
      };
      setVideos(updatedVideos);
    } else {
      setVideos([videoWithSummary, ...videos]);
      setCurrentIndex(0);
    }

    if (videoWithSummary.segments && videoWithSummary.segments.length > 0) {
      const bestSegment = videoWithSummary.segments[0];
      setActiveSegment({ start: bestSegment.start_time, end: bestSegment.end_time });
    }

    setShowResults(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? videos.length - 1 : prevIndex - 1));
    setActiveSegment(null);
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex === videos.length - 1 ? 0 : prevIndex + 1));
    setActiveSegment(null);
  };

  const handleInteractiveMode = () => {
    window.location.href = `/videoplayer/${videos[currentIndex].videoId}`;
  };

  const playSegment = (start, end) => {
    setActiveSegment({ start, end });
  };

  if (!userId) {
    return <p className="text-gray-500 p-4 text-center">Please log in to view your recent videos.</p>;
  }

  const currentVideo = videos.length > 0 ? videos[currentIndex] : null;

  return (
    <div className="text-white relative bg-black bg-gradient-to-br from-green-900/20 via-black to-green-900/20 pt-6" onClick={() => setShowResults(false)}>

      {/* Search Bar Container */}
      <div className="max-w-3xl mx-auto mb-8 px-8 relative" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Search your video content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
            className="w-full backdrop-blur-md text-gray-200 border border-white/20 rounded-2xl py-3 px-4 focus:outline-none focus:border-green-400 focus:bg-white/15 transition-all shadow-xl pr-24 placeholder:text-gray-400"
          />
          <button
            onClick={handleSearch}
            className="absolute right-0 top-0 bottom-0 bg-green-600/90 backdrop-blur-sm hover:bg-green-500 text-white px-6 rounded-r-2xl flex items-center justify-center transition-all font-semibold shadow-lg"
          >
            {isSearching ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : "Search"}
          </button>
        </div>

        {/* Search Results Dropdown */}
        {showResults && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-black/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden z-35 max-h-96 overflow-y-auto mx-5 lg:mx-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {searchResults.length === 0 ? (
              <div className="p-4 text-gray-400 text-center">No results found.</div>
            ) : (
              searchResults.map((result) => (
                <div
                  key={result.videoId}
                  onClick={() => handleSelectResult(result)}
                  className="flex items-start p-4 hover:bg-white/10 cursor-pointer border-b border-white/10 last:border-none transition-all group backdrop-blur-sm"
                >
                  {/* Thumbnail or Icon */}
                  <div className="flex-shrink-0 mr-4 relative">
                    <img
                      src={`https://img.youtube.com/vi/${result.videoId}/default.jpg`}
                      alt="Video Thumbnail"
                      className="w-20 h-14 object-cover rounded-lg border border-white/20 group-hover:border-green-400 group-hover:shadow-lg group-hover:shadow-green-500/30 transition-all"
                    />
                    <div className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-sm text-[10px] px-1.5 py-0.5 rounded text-green-300 font-mono font-semibold">
                      {result.segments.length}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-grow min-w-0">
                    <h4 className="text-sm font-semibold text-green-300 truncate mb-2 group-hover:text-green-200 transition-colors">
                      {result.title || "Untitled Video"}
                    </h4>

                    <div className="mt-1 flex gap-2 flex-wrap">
                      {result.segments.slice(0, 3).map((seg, i) => (
                        <span key={i} className="text-[11px] bg-white/10 backdrop-blur-sm text-gray-200 px-2 py-1 rounded-md border border-white/20 font-mono hover:bg-green-500/20 hover:border-green-400/50 transition-all">
                          {Math.floor(seg.start_time / 60)}:{(seg.start_time % 60).toString().padStart(2, '0')}
                        </span>
                      ))}
                      {result.segments.length > 3 && (
                        <span className="text-[11px] text-gray-400 px-2 py-1">
                          +{result.segments.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Priority Badge */}
                  <div className="flex-shrink-0 ml-3 flex flex-col items-center gap-1">
                    <span className={`w-4 h-4 rounded-full block ${result.priority.color.split(' ')[0]} shadow-lg`} title={`${result.priority.label} Priority`}></span>
                    <span className="text-[9px] text-gray-400 uppercase tracking-wide">{result.priority.label}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {videos.length === 0 ? (
        <p className="p-4 text-center">
          No recent videos with notes found.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mx-5 my-5">
          <div className="lg:col-span-2 relative">
            {currentVideo && (
              <div className="bg-black bg-opacity-40 backdrop-blur-sm rounded-xl overflow-hidden shadow-2xl">
                <div className="relative pb-[50.25%] h-0">
                  <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${currentVideo.videoId}?start=${activeSegment ? activeSegment.start : 0}${activeSegment ? `&end=${activeSegment.end}` : ''}&autoplay=${activeSegment ? 1 : 0}`}
                    title={`YouTube video ${currentIndex + 1}`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>

                {/* Segments & Controls */}
                <div className="p-4">
                  {currentVideo.segments && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-400 mb-2">Relevant Segments:</h3>
                      <div className="flex flex-wrap gap-2">
                        {currentVideo.segments.map((seg, idx) => (
                          <button
                            key={idx}
                            onClick={() => playSegment(seg.start_time, seg.end_time)}
                            className={`px-3 py-1 text-xs rounded-full border transition-colors ${activeSegment && activeSegment.start === seg.start_time
                              ? 'bg-green-500 text-black border-green-500'
                              : 'bg-transparent text-green-300 border-green-300 hover:bg-green-900'
                              }`}
                          >
                            {Math.floor(seg.start_time / 60)}:{Math.floor(seg.start_time % 60).toString().padStart(2, '0')} - {Math.floor(seg.end_time / 60)}:{Math.floor(seg.end_time % 60).toString().padStart(2, '0')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <button
                      className="w-10 h-10 border border-green-300 rounded-full bg-black hover:bg-gray-700 flex items-center justify-center text-white"
                      onClick={handlePrevious}
                    >
                      ←
                    </button>

                    <div className="flex items-center gap-3">
                      {currentVideo.priority && (
                        <span className={`px-4 py-2 rounded-lg shadow-lg text-sm font-semibold ${currentVideo.priority.color}`}>
                          {currentVideo.priority.label} Priority
                        </span>
                      )}
                      <button
                        className="px-4 py-2 bg-white text-black font-semibold hover:bg-gray-300 rounded-lg shadow-lg text-sm"
                        onClick={handleInteractiveMode}
                      >
                        Interactive Mode
                      </button>
                    </div>

                    <button
                      className="w-10 h-10 rounded-full border border-green-300 bg-black hover:bg-opacity-50 flex items-center justify-center text-white"
                      onClick={handleNext}
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Carousel Indicators */}
            <div className="flex justify-center mt-4 space-x-2">
              {videos.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full cursor-pointer ${idx === currentIndex ? 'bg-green-300' : 'bg-gray-500'
                    }`}
                  onClick={() => { setCurrentIndex(idx); setActiveSegment(null); }}
                ></div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            {currentVideo && (
              <div className="bg-black bg-opacity-40 backdrop-blur-sm rounded-xl p-6 shadow-2xl h-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-green-300">
                    {showSummary ? 'Summary' : 'Notes'}
                  </h2>
                  <div className="flex bg-gray-700 rounded-lg p-1">
                    <button
                      className={`px-3 py-1 rounded-md text-sm transition-colors ${showSummary ? 'bg-green-500 text-black font-bold' : 'text-gray-300 hover:text-white'}`}
                      onClick={() => setShowSummary(true)}
                    >
                      Summary
                    </button>
                    <button
                      className={`px-3 py-1 rounded-md text-sm transition-colors ${!showSummary ? 'bg-green-500 text-black font-bold' : 'text-gray-300 hover:text-white'}`}
                      onClick={() => setShowSummary(false)}
                    >
                      Notes
                    </button>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4 mb-4 flex-grow overflow-y-auto max-h-[400px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {showSummary ? (
                    (() => {
                      const summary = currentVideo.summary;

                      if (!summary) {
                        return <p className="text-gray-400 italic">No summary available for this video.</p>;
                      }

                      // Handle string summary
                      if (typeof summary === 'string') {
                        return <SummaryFormatter content={summary} />;
                      }

                      // Handle object summary
                      const snippet = currentVideo.segments?.[0]?.summary_snippet;
                      const hasOverview = summary?.summary && summary.summary !== snippet;
                      const hasTopic = summary?.primaryTopic;
                      const hasCategory = summary?.subjectCategory;
                      const hasPrereqs = summary?.prerequisiteTopics?.length > 0;

                      const hasContent = hasOverview || hasTopic || hasCategory || hasPrereqs;

                      if (!hasContent) {
                        return <p className="text-gray-400 italic">No summary available for this video.</p>;
                      }

                      const formattedSummary = [
                        summary.summary ? `### Overview\n${summary.summary}` : '',
                        summary.primaryTopic ? `### Primary Topic\n${summary.primaryTopic}` : '',
                        summary.subjectCategory ? `### Category\n${summary.subjectCategory}` : '',
                        (summary.prerequisiteTopics?.length > 0) ? `### Prerequisites\n${summary.prerequisiteTopics.map(t => `- ${t}`).join('\n')}` : ''
                      ].filter(Boolean).join('\n\n');

                      return <SummaryFormatter content={formattedSummary} />;
                    })()
                  ) : (
                    <p className="text-gray-100 whitespace-pre-line">{currentVideo.content}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default RecentVideos;
