"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import HomeVideoCard from "../../Components/sections/HomeVideoCard";
import Link from "next/link";
import { useSelector, useDispatch } from 'react-redux';
import { selectUser } from '../../../store/userSlice';
import { setCategorizedVideos, clearCategorizedVideos } from '../../../store/HomeSlice';
import { fetchAllVideos } from "@/services/homePage";
import { searchRecommendations } from "@/utils/recommendations";
import InstallExtension from '../layout/InstallExtension';
import IncompleteOnboarding from '@/utils/IncompleteOnboarding';
import { isExtensionAvailable } from '@/utils/ExtensionCheck';

const VideoPage = ({ onLoaded }) => {
  const dispatch = useDispatch();
  const reduxUser = useSelector(selectUser);
  const categorizedVideos = useSelector((state) => state.home.categorizedVideos || {});

  const [showVideos, setShowVideos] = useState(false);
  const [scrollVisibility, setScrollVisibility] = useState({});
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [showInstallExtension, setShowInstallExtension] = useState(false);
  const [showIncompleteOnboarding, setShowIncompleteOnboarding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check if the Gradus extension is available
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ok = await isExtensionAvailable(2000);
        if (!cancelled) setShowInstallExtension(!ok);
      } catch (_) {
        if (!cancelled) setShowInstallExtension(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Clear videos from Redux when user leaves the website
  useEffect(() => {
    const handleBeforeUnload = () => {
      dispatch(clearCategorizedVideos());
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dispatch]);

  const scrollRef = useRef({});

  // Fetch videos function that can be called on mount or refresh
  const fetchVideos = async (forceRefresh = false) => {
    if (!reduxUser?.uid) {
      console.warn("No user in Redux, skipping video fetch");
      return;
    }

    // Skip if videos already exist in Redux and not forcing refresh
    if (!forceRefresh && Object.keys(categorizedVideos).length > 0) {
      setShowVideos(true);
      return;
    }

    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setShowVideos(false);

    try {
      // Fetch queries from backend
      const data = await fetchAllVideos(reduxUser.uid);

      if (data && data.queries && Object.keys(data.queries).length > 0) {
        const queries = data.queries; // Object { category: query }
        const queryEntries = Object.entries(queries).map(([category, query]) => ({ category, query }));
        const totalCategories = queryEntries.length;

        setLoadingProgress({ current: 0, total: totalCategories });

        // Execute all searches in parallel
        const fetchPromises = queryEntries.map(async ({ category, query }) => {
          try {
            const result = await searchRecommendations(query, 10);

            // Update progress incrementally
            setLoadingProgress(prev => ({ ...prev, current: Math.min(prev.current + 1, totalCategories) }));

            return { category, result };
          } catch (error) {
            console.error(`Error fetching videos for ${category}:`, error);
            return { category, result: { success: false, error: error.message } };
          }
        });

        const results = await Promise.all(fetchPromises);

        // Process results
        const videoData = {};

        results.forEach(({ category, result }) => {
          try {
            // Extension returns 'items' not 'videos'
            const videos = result?.items || result?.videos || [];

            if (result && result.success && videos.length > 0) {
              // Filter out videos shorter than 10 minutes (600000 milliseconds)
              videoData[category] = videos
                .filter(video => {
                  const duration = video.duration || 0;
                  return duration >= 600000; // 10 minutes
                })
                .map(video => ({
                  videoId: video.id,
                  title: video.title,
                  channelName: video.channelName || (typeof video.channel === 'object' ? video.channel?.name : video.channel) || 'Unknown Channel',
                  thumbnail: video.thumbnail,
                  duration: video.duration,
                  uploadedAt: video.publishedAt,
                  views: video.views,
                  url: video.url || `https://www.youtube.com/watch?v=${video.id}`
                }));
            } else {
              videoData[category] = [];
            }
          } catch (error) {
            console.error(`Error processing videos for ${category}:`, error);
            videoData[category] = [];
          }
        });

        // Store in Redux
        dispatch(setCategorizedVideos(videoData));
        setLoadingProgress({ current: totalCategories, total: totalCategories });

        // Initialize scroll button visibility state
        const initialVisibility = {};
        Object.keys(videoData).forEach((category) => {
          initialVisibility[category] = { left: false, right: true };
        });
        setScrollVisibility(initialVisibility);
      } else {
        // If data or data.queries is missing or empty, show onboarding popup
        setShowIncompleteOnboarding(true);
      }
    } catch (error) {
      console.error("Error fetching videos:", error);
      // If it's a 404 or data not found, show the onboarding popup
      if (error.response?.status === 404 || error.message?.includes("not found")) {
        setShowIncompleteOnboarding(true);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setShowVideos(true);
    }
  };

  // Fetch videos on mount
  useEffect(() => {
    fetchVideos(false);
  }, [reduxUser]);

  // Handle refresh button click
  const handleRefresh = () => {
    fetchVideos(true);
  };

  const updateScrollButtonVisibility = (category) => {
    const container = scrollRef.current[category];
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setScrollVisibility((prev) => ({
        ...prev,
        [category]: {
          left: scrollLeft > 0,
          right: scrollLeft < scrollWidth - clientWidth - 10,
        },
      }));
    }
  };

  const scroll = (category, direction) => {
    const container = scrollRef.current[category];
    if (container) {
      const scrollAmount = container.clientWidth * 0.8;
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });

      setTimeout(() => {
        updateScrollButtonVisibility(category);
      }, 500);
    }
  };

  useEffect(() => {
    Object.keys(scrollRef.current).forEach((category) => {
      const container = scrollRef.current[category];
      if (container) {
        const handleScroll = () => updateScrollButtonVisibility(category);
        container.addEventListener("scroll", handleScroll);

        // Initial visibility check
        updateScrollButtonVisibility(category);
      }
    });

    return () => {
      Object.keys(scrollRef.current).forEach((category) => {
        const container = scrollRef.current[category];
        if (container) {
          const handleScroll = () => updateScrollButtonVisibility(category);
          container.removeEventListener("scroll", handleScroll);
        }
      });
    };
  }, [categorizedVideos]);

  return (
    <>
      <div className="p-6 space-y-12">
        {/* Refresh Button - Top Right */}
        {!isLoading && Object.keys(categorizedVideos).length > 0 && (
          <div className="flex justify-end mb-4">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-all duration-200 shadow-lg ${isRefreshing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                }`}
              aria-label="Refresh feed"
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Feed'}
            </button>
          </div>
        )}
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
            <div className="relative">
              {/* Animated spinner */}
              <div className="w-20 h-20 border-4 border-green-200 border-t-green-500 rounded-full animate-spin"></div>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-white">Loading Your Videos</h3>
              <p className="text-green-400 text-lg">
                Fetching personalized content from your interests...
              </p>
              {loadingProgress.total > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-white text-sm">
                    Loading category {loadingProgress.current} of {loadingProgress.total}
                  </p>
                  {/* Progress bar */}
                  <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden mx-auto">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-300 ease-out"
                      style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Video Categories */}
        {!isLoading && Object.keys(categorizedVideos || {}).map((category) => (
          <div key={category} className="relative">
            <h2 className="text-2xl font-bold mb-4 text-white transition-colors">
              {`${category}`}
            </h2>

            <div
              className="relative"
              onMouseEnter={() => setHoveredCategory(category)}
              onMouseLeave={() => setHoveredCategory(null)}
            >
              {/* Left Scroll Button */}
              {scrollVisibility[category]?.left && (
                <button
                  className={`absolute left-0 top-1/2 transform -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white p-3 rounded-full shadow-xl z-20 transition-all duration-300 ${hoveredCategory === category
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-2 pointer-events-none'
                    }`}
                  onClick={() => scroll(category, "left")}
                  aria-label="Scroll left"
                >
                  <ChevronLeft size={28} strokeWidth={2.5} />
                </button>
              )}

              {/* Scrollable Video Row */}
              <div
                ref={(el) => (scrollRef.current[category] = el)}
                className="flex overflow-x-hidden hide-scrollbar gap-4 pb-16 border-b-2 border-green-200 scroll-smooth"
                onScroll={() => updateScrollButtonVisibility(category)}
              >
                {(categorizedVideos[category] || []).map((video) => (
                  <HomeVideoCard key={video.videoId} video={video} />
                ))}
              </div>

              {/* Right Scroll Button */}
              {scrollVisibility[category]?.right && (
                <button
                  className={`absolute right-0 top-1/2 transform -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white p-3 rounded-full shadow-xl z-20 transition-all duration-300 ${hoveredCategory === category
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 translate-x-2 pointer-events-none'
                    }`}
                  onClick={() => scroll(category, "right")}
                  aria-label="Scroll right"
                >
                  <ChevronRight size={28} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <InstallExtension open={showInstallExtension} onClose={() => setShowInstallExtension(false)} />
      <IncompleteOnboarding open={showIncompleteOnboarding} onClose={() => setShowIncompleteOnboarding(false)} />
    </>
  );
};

export default VideoPage;