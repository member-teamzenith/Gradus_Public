"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PlaylistCard from "../layout/PlaylistCard";
import Loader from "../common/Loader";
import { auth } from "../../lib/Firebase";
import { fetchUserDetails } from "@/services/userServices";
import { API_URL } from "@/server";

const PlaylistPage = () => {
  const [playlists, setPlaylists] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const [userDetails, setUserDetails] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const response = await fetchUserDetails(user.uid);
          const userData = response.data || response;
          console.log("Fetched user details:", userData); // Debugging
          setUserDetails(userData);
        } catch (error) {
          console.error("Error fetching user data:", error.message);
        }
      } else {
        console.log("No user is signed in.");
      }
    });

    return () => unsubscribe();
  }, []);



  const [scrollVisibility, setScrollVisibility] = useState({
    left: false,
    right: true,
  });



  const updateScrollButtonVisibility = () => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth, scrollWidth } = scrollRef.current;
      setScrollVisibility({
        left: scrollLeft > 0,
        right: scrollLeft + clientWidth < scrollWidth - 10,
      });
    }
  };

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  const fetchWithRetry = async (endpoint, params, attempt = 0) => {
    try {
      const response = await axios.get(endpoint, { params });
      return response;
    } catch (error) {
      if (error.message === 'Network Error' && attempt < MAX_RETRIES) {
        console.log(`Retry attempt ${attempt + 1} of ${MAX_RETRIES}`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return fetchWithRetry(endpoint, params, attempt + 1);
      }
      throw error;
    }
  };

  useEffect(() => {
    // console.log("Props received in PlaylistPage:", zone);

    // if (!zone) {
    //   console.error("Error: zone is undefined. Check if the parent component is passing it correctly.");
    //   setError("Invalid zone configuration");
    //   return;
    // }

    if (!userDetails || !userDetails.email) {
      // console.log("User details not loaded yet, waiting...");
      return; // 🔥 Prevent API call until userDetails is available
    }

    const fetchPlaylist = async () => {
      if (playlists) return; // Prevent multiple API calls

      setIsLoading(true);
      setError(null);

      try {
        const endpoint = `${API_URL}/fetchAllPlaylists`;

        // console.log("Fetching playlist for user:", userDetails.email); // Debugging

        const response = await fetchWithRetry(endpoint, {
          email: userDetails.email, // 
        });

        if (response.data?.playlists) {
          setPlaylists(response.data.playlists);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (error) {
        console.error("Error fetching playlists:", error);
        let errorMessage = "Failed to load playlists";

        if (error.message === 'Network Error') {
          errorMessage = "Unable to connect to server. Please check your internet connection.";
        } else if (error.response) {
          errorMessage = `Server error: ${error.response.data?.error || error.response.status}`;
        }

        setError(errorMessage);
        setRetryCount(prev => prev + 1);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlaylist();
  }, [userDetails]);


  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollTo({
        left: direction === "left" ? scrollRef.current.scrollLeft - scrollAmount : scrollRef.current.scrollLeft + scrollAmount,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    if (!scrollRef.current) return;
    const updateScrollVisibility = () => {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setScrollVisibility({
        left: scrollLeft > 0,
        right: scrollLeft < scrollWidth - clientWidth - 10,
      });
    };

    scrollRef.current.addEventListener("scroll", updateScrollVisibility);
    updateScrollVisibility();

    return () => scrollRef.current?.removeEventListener("scroll", updateScrollVisibility);
  }, [playlists]);

  return (
    <div className="p-6 space-y-12 mt-4">
      {isLoading && <Loader text="Fetching quality content for you... great things take time!" />}
      {error && <div className="text-red-500 text-center">{error}</div>}

      {!isLoading && !error && playlists && (
        <>
          <h2 className="text-2xl font-bold mb-4 text-white">Curated playlists for you</h2>
          <div className="relative group">
            {scrollVisibility.left && (
              <button
                className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => scroll("left")}
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <div ref={scrollRef} className="flex overflow-hidden hide-scrollbar gap-4 pb-6">
              {Object.keys(playlists).map((playlistId) => (
                <PlaylistCard key={playlistId} playlist={playlists[playlistId]} playlistId={playlistId} />
              ))}
            </div>

            {scrollVisibility.right && (
              <button
                className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => scroll("right")}
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PlaylistPage;
