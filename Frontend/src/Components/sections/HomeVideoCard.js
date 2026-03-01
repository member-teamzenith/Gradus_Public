"use client";

import { useEffect, useState, useCallback } from "react";
import { auth, db } from "../../lib/Firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

// copied from SearchVideos: formats ms -> "m:ss" or "h:mm:ss"
const formatDuration = (ms) => {
  if (!ms || typeof ms !== "number" || ms <= 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const HomeVideoCard = ({ video }) => {
  const router = useRouter();
  const [userID, setUserId] = useState("");
  const [userDetails, setUserDetails] = useState(null);

  useEffect(() => {
    // keep the minimal fetch-on-mount behavior (you can lift this up later)
    const fetchUserDetails = async (user) => {
      if (!user) {
        setUserDetails(null);
        return;
      }
      setUserId(user.uid);
      try {
        const docRef = doc(db, "Users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setUserDetails(docSnap.data());
      } catch (error) {
        console.error("Error fetching user data:", error.message);
      }
    };

    fetchUserDetails(auth.currentUser);
    const unsubscribe = auth.onAuthStateChanged(fetchUserDetails);
    return () => unsubscribe();
  }, []);

  const handleVideoClick = useCallback(
    async (e) => {
      // preserve existing behaviour but prefer Next navigation (you can swap to router.push)
      e.preventDefault();
      e.stopPropagation();

      try {
        const user = auth.currentUser;
        if (!user) {
          console.log("No user logged in.");
          return;
        }

        const knightShipRef = doc(db, "KnightShips", video.videoId);
        await setDoc(knightShipRef, {}); // consider merge if preserving data

        // consistent navigation with Next
        router.push(`/videoplayer/${video.videoId}`);
      } catch (error) {
        console.error("Error adding video to KnightShip collection:", error);
      }
    },
    [video?.videoId, router]
  );

  // match SearchVideos thumbnail/channel detection & duration usage
  const id = video?.id || video?.videoId || video?.video_id;
  const title = video?.title || video?.name || "Untitled";
  const thumb = video?.thumbnail?.url || video?.thumbnail_url || video?.thumbnail || video?.thumb || null;
  const channel = video?.channel?.name || video?.author || video?.uploader || video?.channelName || "";
  const duration = formatDuration(typeof video?.duration === "number" ? video.duration : (video?.lengthMs || 0));

  return (
    <Link
      key={id}
      href={id ? `/videoplayer/${id}` : "#"}
      onClick={handleVideoClick}
      className="group relative block min-w-[320px] sm:min-w-[360px] aspect-[16/9] rounded-xl border border-green-300/30 hover:border-[#18cb96] transition-colors bg-black/20 backdrop-blur-md overflow-hidden transform transition-transform duration-300 ease-out hover:scale-105"

    >
      {/* Thumbnail */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={title} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">No thumbnail</div>
        )}
      </div>

      {/* Duration badge */}
      {duration && (
        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded z-10">
          {duration}
        </span>
      )}

      {/* Centered hover CTA */}
      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
        <span className="pointer-events-auto inline-block bg-[#18cb96] text-black font-semibold rounded-full px-4 py-2 text-sm sm:text-base transition-all opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100">
          Watch Now
        </span>
      </div>

      {/* Bottom overlay content */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-3 pb-2 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
        <h3 className="text-white text-base sm:text-lg font-semibold truncate" title={title}>{title}</h3>
        {channel && (
          <p className="text-gray-200 text-xs mt-0.5 truncate">{channel}</p>
        )}
      </div>
    </Link>
  );
};

export default HomeVideoCard;
